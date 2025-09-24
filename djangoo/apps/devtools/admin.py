from __future__ import annotations

from django.contrib import admin, messages
from django.conf import settings
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path
from django import forms
from django.db import connection

from .models import DevPanel


def _resolve_tenant_id(request) -> str | None:
    tid = request.GET.get('tenantId') or request.POST.get('tenantId')
    if tid:
        return tid
    host_header = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')
    if host_header:
        host = host_header.split(':')[0]
        try:
            from apps.tenants.models import TenantDomain  # type: ignore
            dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
            if dom and getattr(dom, 'tenant_id', None):
                return str(dom.tenant_id)
        except Exception:
            pass
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


def _get_page(tenant_id: str, key: str) -> str:
    try:
        _ensure_table()
        with connection.cursor() as c:
            c.execute('SELECT content FROM site_page WHERE "tenantId"=%s AND "key"=%s LIMIT 1', [tenant_id, key])
            row = c.fetchone()
            return row[0] if row and row[0] is not None else ''
    except Exception:
        return ''


def _set_page(tenant_id: str, key: str, content: str) -> None:
    try:
        _ensure_table()
        with connection.cursor() as c:
            c.execute('UPDATE site_page SET content=%s, "updatedAt"=NOW() WHERE "tenantId"=%s AND "key"=%s', [content, tenant_id, key])
            if c.rowcount == 0:
                import uuid
                c.execute('INSERT INTO site_page (id, "tenantId", "key", content, "updatedAt") VALUES (%s,%s,%s,%s,NOW())', [str(uuid.uuid4()), tenant_id, key, content])
    except Exception:
        pass

def _get_page_with_meta(tenant_id: str, key: str) -> tuple[str, str | None]:
    """Return (content, updatedAt ISO) if available; otherwise ('', None)."""
    try:
        _ensure_table()
        with connection.cursor() as c:
            c.execute('SELECT content, "updatedAt" FROM site_page WHERE "tenantId"=%s AND "key"=%s LIMIT 1', [tenant_id, key])
            row = c.fetchone()
            if not row:
                return '', None
            content = row[0] or ''
            updated = row[1].isoformat() if row[1] else None
            return content, updated
    except Exception:
        return '', None


def _ensure_table() -> None:
    """Ensure the simple key/value table used for pages exists (matches apps.pages.views)."""
    try:
        with connection.cursor() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS site_page (
                    id UUID PRIMARY KEY,
                    "tenantId" UUID NULL,
                    "key" VARCHAR(50) NOT NULL,
                    content TEXT NULL,
                    "updatedAt" TIMESTAMP NULL
                );
                """
            )
            c.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes WHERE schemaname = ANY(current_schemas(false)) AND indexname = 'idx_site_page_tenant_key'
                    ) THEN
                        CREATE INDEX idx_site_page_tenant_key ON site_page ("tenantId", "key");
                    END IF;
                END$$;
                """
            )
    except Exception:
        # Non-fatal – reads/writes will simply return defaults
        pass


class BannerForm(forms.Form):
    tenantId = forms.CharField(required=False, label="Tenant ID (اختياري)")
    text = forms.CharField(widget=forms.Textarea, required=False, label="نص التنبيه أعلى الهيدر")
    enabled = forms.BooleanField(required=False, label="تفعيل التنبيه")


class MaintenanceForm(forms.Form):
    message = forms.CharField(widget=forms.Textarea, required=False, label="رسالة وضع الصيانة")
    enabled = forms.BooleanField(required=False, label="تفعيل وضع الصيانة")


class Force2FAForm(forms.Form):
    force_all = forms.BooleanField(required=False, label="فرض تفعيل المصادقة الثنائية على الجميع (ما عدا المطوّر)")


@admin.register(DevPanel)
class DevPanelAdmin(admin.ModelAdmin):
    change_list_template = "admin/devtools_panel.html"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return True

    def has_module_permission(self, request):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_view_permission(request, obj)

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path("apply/", self.admin_site.admin_view(self.apply_changes), name="devtools-apply"),
            path("maintenance/", self.admin_site.admin_view(self.apply_maintenance), name="devtools-maintenance"),
            path("force2fa/", self.admin_site.admin_view(self.apply_force2fa), name="devtools-force2fa"),
        ]
        return custom + urls
        ctx = {**base_ctx, "form": form, "title": "التنبيهات", "opts": opts, "app_label": opts.app_label, "last_updated_at": last_updated_at}
    def changelist_view(self, request, extra_context=None):
        tid = _resolve_tenant_id(request)
        form_initial = {"tenantId": tid or ""}
        if tid:
            current_text, last_updated_at = _get_page_with_meta(tid, 'banner_text')
            current_enabled = _get_page(tid, 'banner_enabled') == '1'
        else:
            current_text = ''
            last_updated_at = None
            current_enabled = False
        form_initial.update({"text": current_text, "enabled": current_enabled})
        form = BannerForm(initial=form_initial)
        base_ctx = self.admin_site.each_context(request)
        opts = self.model._meta
        g_text, g_enabled, g_updated = self._get_global_banner()
        # Maintenance state (global – take latest any-tenant keys)
        maint_msg, maint_on = self._get_global_state('maintenance_message'), self._get_global_state('maintenance_on')
        # Force 2FA flag (global – take latest any-tenant)
        force2fa = self._get_global_state('force_2fa') == '1'
        maint_form = MaintenanceForm(initial={
            'message': maint_msg or 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.',
            'enabled': (maint_on == '1')
        })
        f2_form = Force2FAForm(initial={ 'force_all': force2fa })
        ctx = {**base_ctx, "form": form, "maint_form": maint_form, "force2fa_form": f2_form,
               "title": "التنبيهات", "opts": opts, "app_label": opts.app_label,
               "last_updated_at": last_updated_at, "global_banner_text": g_text, "global_banner_enabled": g_enabled, "global_banner_updated_at": g_updated,
               "maint_enabled": (maint_on == '1'), "maint_message": maint_msg or ''}
        return TemplateResponse(request, self.change_list_template, ctx)
    def _get_global_banner(self) -> tuple[str, bool, str | None]:
        """Fetch the latest saved banner (any tenant) to display in the admin panel."""
        try:
            _ensure_table()
            with connection.cursor() as c:
                c.execute('SELECT content, "updatedAt" FROM site_page WHERE "key"=%s ORDER BY "updatedAt" DESC NULLS LAST LIMIT 1', ['banner_text'])
                row_t = c.fetchone()
                text = (row_t[0] or '') if row_t else ''
                t_at = row_t[1].isoformat() if (row_t and row_t[1]) else None
                c.execute('SELECT content, "updatedAt" FROM site_page WHERE "key"=%s ORDER BY "updatedAt" DESC NULLS LAST LIMIT 1', ['banner_enabled'])
                row_e = c.fetchone()
                enabled = (row_e and (row_e[0] == '1')) or False
                e_at = row_e[1].isoformat() if (row_e and row_e[1]) else None
                # pick the more recent timestamp if both exist
                updated = t_at or e_at
                if t_at and e_at:
                    updated = t_at if t_at >= e_at else e_at
                return text, bool(enabled), updated
        except Exception:
            return '', False, None

    def apply_changes(self, request):
        if request.method != 'POST':
            return redirect("..")
        form = BannerForm(request.POST)
        if not form.is_valid():
            base_ctx = self.admin_site.each_context(request)
            opts = self.model._meta
            return TemplateResponse(request, self.change_list_template, {**base_ctx, "form": form, "title": "التنبيهات", "opts": opts, "app_label": opts.app_label})
        text = form.cleaned_data.get('text') or ''
        enabled = bool(form.cleaned_data.get('enabled'))
        # Always apply to all tenants
        try:
            from apps.tenants.models import Tenant  # type: ignore
            tenant_ids = list(Tenant.objects.values_list('id', flat=True))
        except Exception:
            tenant_ids = []

        updated = 0
        for tid_all in tenant_ids:
            _set_page(str(tid_all), 'banner_text', text)
            _set_page(str(tid_all), 'banner_enabled', '1' if enabled else '0')
            updated += 1

        # Feedback messages
        if updated:
            messages.success(request, f"تم الحفظ وتطبيق التنبيه على {updated} مستأجر")
        else:
            messages.warning(request, "لم يتم العثور على مستأجرين لتطبيق التغييرات")
        return redirect("..")

    def apply_maintenance(self, request):
        if request.method != 'POST':
            return redirect('..')
        form = MaintenanceForm(request.POST)
        if not form.is_valid():
            messages.error(request, 'الحقول غير صالحة')
            return redirect('..')
        enabled = bool(form.cleaned_data.get('enabled'))
        message = (form.cleaned_data.get('message') or '').strip()
        try:
            from apps.tenants.models import Tenant  # type: ignore
            tenant_ids = list(Tenant.objects.values_list('id', flat=True))
        except Exception:
            tenant_ids = []
        for tid_all in tenant_ids:
            _set_page(str(tid_all), 'maintenance_on', '1' if enabled else '0')
            if message:
                _set_page(str(tid_all), 'maintenance_message', message)
        messages.success(request, 'تم تحديث وضع الصيانة لجميع المستأجرين')
        return redirect('..')

    def apply_force2fa(self, request):
        if request.method != 'POST':
            return redirect('..')
        form = Force2FAForm(request.POST)
        if not form.is_valid():
            messages.error(request, 'طلب غير صالح')
            return redirect('..')
        force = bool(form.cleaned_data.get('force_all'))
        try:
            from apps.tenants.models import Tenant  # type: ignore
            tenant_ids = list(Tenant.objects.values_list('id', flat=True))
        except Exception:
            tenant_ids = []
        for tid_all in tenant_ids:
            _set_page(str(tid_all), 'force_2fa', '1' if force else '0')
        messages.success(request, 'تم تحديث إعداد المصادقة الثنائية')
        return redirect('..')

    def _get_global_state(self, key: str) -> str:
        try:
            _ensure_table()
            with connection.cursor() as c:
                c.execute('SELECT content FROM site_page WHERE "key"=%s ORDER BY "updatedAt" DESC NULLS LAST LIMIT 1', [key])
                row = c.fetchone()
                return row[0] if row and row[0] is not None else ''
        except Exception:
            return ''
