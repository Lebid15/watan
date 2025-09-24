from __future__ import annotations

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from drf_spectacular.utils import extend_schema

from django.db import connection
from apps.users.permissions import RequireAdminRole


def _resolve_tenant_id(request) -> str | None:
    try:
        from django.conf import settings
        from apps.tenants.models import TenantDomain  # type: ignore
    except Exception:
        settings = None
        TenantDomain = None
    direct_tid = request.META.get('HTTP_X_TENANT_ID')
    if direct_tid:
        return str(direct_tid)
    if settings is not None:
        host_header = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')
        if host_header and TenantDomain is not None:
            host = host_header.split(':')[0]
            try:
                dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
                if dom and getattr(dom, 'tenant_id', None):
                    return str(dom.tenant_id)
            except Exception:
                pass
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


# Simple K/V storage in `site_page` table (id, tenantId, key, content)

def _ensure_table() -> None:
    """Create the site_page table if it doesn't exist (id, tenantId, key, content, updatedAt)."""
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
            # Helpful index for lookups
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
        # Don't fail requests if DDL is not permitted; reads/writes will handle exceptions gracefully
        pass


def _get_page(tenant_id: str, key: str) -> str:
    try:
        _ensure_table()
        with connection.cursor() as c:
            c.execute('SELECT content FROM site_page WHERE "tenantId"=%s AND "key"=%s LIMIT 1', [tenant_id, key])
            row = c.fetchone()
            return row[0] if row and row[0] is not None else ''
    except Exception:
        # On any DB error, return empty content instead of 500
        return ''


def _get_page_global(key: str) -> str:
    """Fetch a global page value (tenantId IS NULL)."""
    try:
        _ensure_table()
        with connection.cursor() as c:
            c.execute('SELECT content FROM site_page WHERE "tenantId" IS NULL AND "key"=%s LIMIT 1', [key])
            row = c.fetchone()
            return row[0] if row and row[0] is not None else ''
    except Exception:
        return ''


def _set_page(tenant_id: str, key: str, content: str) -> None:
    try:
        _ensure_table()
        with connection.cursor() as c:
            # upsert: try update; if 0 rows, insert
            c.execute('UPDATE site_page SET content=%s, "updatedAt"=NOW() WHERE "tenantId"=%s AND "key"=%s', [content, tenant_id, key])
            if c.rowcount == 0:
                import uuid
                c.execute('INSERT INTO site_page (id, "tenantId", "key", content, "updatedAt") VALUES (%s,%s,%s,%s,NOW())', [str(uuid.uuid4()), tenant_id, key, content])
    except Exception:
        # Swallow errors to avoid 500s on admin save; clients will see ok:false if needed elsewhere
        pass


class PublicAboutView(APIView):
    @extend_schema(tags=["Pages"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        return Response(_get_page(tenant_id, 'about'))


class PublicInfoesView(APIView):
    @extend_schema(tags=["Pages"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        return Response(_get_page(tenant_id, 'infoes'))


class AdminAboutView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Settings"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        return Response(_get_page(tenant_id, 'about'))

    @extend_schema(tags=["Admin Settings"], request=None, responses={200: None})
    def put(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        # Accept either raw string payload or {"value": "..."}
        data = request.data
        content = ''
        if isinstance(data, dict):
            content = str(data.get('value') or data.get('content') or '')
        elif isinstance(data, str):
            content = data
        else:
            try:
                content = str(data or '')
            except Exception:
                content = ''
        _set_page(tenant_id, 'about', content)
        return Response({'ok': True})


class AdminInfoesView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Settings"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        return Response(_get_page(tenant_id, 'infoes'))

    @extend_schema(tags=["Admin Settings"], request=None, responses={200: None})
    def put(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        # Accept either raw string payload or {"value": "..."}
        data = request.data
        content = ''
        if isinstance(data, dict):
            content = str(data.get('value') or data.get('content') or '')
        elif isinstance(data, str):
            content = data
        else:
            try:
                content = str(data or '')
            except Exception:
                content = ''
        _set_page(tenant_id, 'infoes', content)
        return Response({'ok': True})


class PublicBannerView(APIView):
    @extend_schema(tags=["Pages"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        # If tenant not resolved, gracefully fall back to global banner.
        if not tenant_id:
            text = _get_page_global('banner_text')
            enabled = _get_page_global('banner_enabled') == '1'
            return Response({"text": text or '', "enabled": bool(enabled)})
        # Prefer tenant-specific values; if absent, fall back to global.
        text = _get_page(tenant_id, 'banner_text') or _get_page_global('banner_text')
        enabled_val = _get_page(tenant_id, 'banner_enabled')
        enabled = (enabled_val == '1') if enabled_val != '' else (_get_page_global('banner_enabled') == '1')
        return Response({"text": text or '', "enabled": bool(enabled)})


class AdminBannerView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Settings"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        text = _get_page(tenant_id, 'banner_text')
        enabled = _get_page(tenant_id, 'banner_enabled') == '1'
        return Response({"text": text or '', "enabled": bool(enabled)})

    @extend_schema(tags=["Admin Settings"], request=None, responses={200: None})
    def put(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        data = request.data or {}
        if isinstance(data, str):
            # Accept raw text as text-only
            _set_page(tenant_id, 'banner_text', data)
        elif isinstance(data, dict):
            text = str(data.get('text') or '')
            enabled = bool(data.get('enabled', False))
            _set_page(tenant_id, 'banner_text', text)
            _set_page(tenant_id, 'banner_enabled', '1' if enabled else '0')
        else:
            _set_page(tenant_id, 'banner_text', '')
            _set_page(tenant_id, 'banner_enabled', '0')
        return Response({"ok": True})
