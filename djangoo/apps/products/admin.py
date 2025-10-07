from __future__ import annotations

from django.contrib import admin
from django.conf import settings
from django.db.models import Count
from django.db import IntegrityError, transaction
from django.utils.html import format_html
from django.urls import reverse
from django import forms
from .models import Product, ProductPackage, PriceGroup, PackagePrice


GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000'


class ProductFilterForPackages(admin.SimpleListFilter):
    """فلتر مخصص يعرض المنتجات الجديدة فقط (من جدول product)"""
    title = 'المنتج'
    parameter_name = 'product'

    def lookups(self, request, model_admin):
        # عرض المنتجات الجديدة فقط (GLOBAL)
        products = Product.objects.filter(
            tenant_id__in=[GLOBAL_TENANT_ID, None]
        ).order_by('name')
        return [(p.id, p.name) for p in products]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(product_id=self.value())
        return queryset


class ProductPackageInline(admin.TabularInline):
    """عرض الباقات داخل صفحة المنتج"""
    model = ProductPackage
    extra = 0
    fields = ('name', 'public_code', 'base_price', 'capital', 'is_active')
    ordering = ('public_code',)
    verbose_name = 'باقة'
    verbose_name_plural = 'الباقات'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('product')


class DevVisibleAdminMixin:
    """Show only in DEBUG to avoid confusion in production."""

    def has_module_permission(self, request):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return False

    def has_view_permission(self, request, obj=None):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return False

    def has_add_permission(self, request):
        # Allow adding in DEBUG (see note on required tenant_id below)
        return getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff

    def has_change_permission(self, request, obj=None):
        return getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff

    def has_delete_permission(self, request, obj=None):
        # Avoid hard-deletes from admin to prevent FK violations (orders referencing products)
        return False


@admin.register(Product)
class ProductAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    # List: name (editable), packages count, status (editable), edit link
    list_display = ("edit_link", "name", "packages_count", "is_active")
    list_display_links = ("edit_link",)
    list_editable = ("name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("name",)
    # Limit fields in the form to essentials; other fields remain hidden
    fields = ("name", "is_active", "image_upload")
    # Show packages inline on the product detail page
    inlines = [ProductPackageInline]  # عرض الباقات داخل صفحة المنتج
    actions = ["action_enable_selected", "action_disable_selected", "action_delete_if_unused"]

    def get_actions(self, request):
        actions = super().get_actions(request)
        # Remove Django's bulk delete to avoid FK issues
        actions.pop('delete_selected', None)
        return actions

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Show only GLOBAL catalog in admin to avoid tenant data confusion
        return qs.filter(tenant_id__in=[GLOBAL_TENANT_ID, None]).annotate(_packages_count=Count("packages"))

    def packages_count(self, obj):
        return getattr(obj, "_packages_count", None) or obj.packages.count()

    packages_count.short_description = "عدد الباقات"
    packages_count.admin_order_field = "_packages_count"

    def edit_link(self, obj):
        return format_html('<a class="btn btn-sm btn-secondary" href="{}">فتح</a>', self._change_url(obj))

    edit_link.short_description = "فتح"

    def _change_url(self, obj):
        return reverse('admin:products_product_change', args=[obj.pk])

    def save_formset(self, request, form, formset, change):
        # Ensure new packages inherit tenant_id and product
        instances = formset.save(commit=False)
        for obj in instances:
            if isinstance(obj, ProductPackage):
                if not getattr(obj, "tenant_id", None):
                    obj.tenant_id = form.instance.tenant_id
                if not getattr(obj, "product_id", None):
                    obj.product = form.instance
            obj.save()
        formset.save_m2m()

    def save_model(self, request, obj, form, change):
        # Always treat admin-created products as GLOBAL to avoid accidental tenant binding via middleware
        obj.tenant_id = GLOBAL_TENANT_ID
        super().save_model(request, obj, form, change)

    # ----- Admin actions -----
    def action_enable_selected(self, request, queryset):
        updated = queryset.update(is_active=True)
        # Also enable packages of these products
        ProductPackage.objects.filter(product__in=queryset).update(is_active=True)
        self.message_user(request, f"تم تفعيل {updated} منتج وباقاته")

    action_enable_selected.short_description = "تفعيل المنتجات المحددة"

    def action_disable_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        ProductPackage.objects.filter(product__in=queryset).update(is_active=False)
        self.message_user(request, f"تم تعطيل {updated} منتج وباقاته (بدلاً من الحذف)")

    action_disable_selected.short_description = "تعطيل المنتجات المحددة (آمن)"

    def action_delete_if_unused(self, request, queryset):
        # Try hard-delete individually; on FK error, fall back to disabling and report
        deleted = 0
        disabled = 0
        errors = 0
        for prod in queryset:
            try:
                with transaction.atomic():
                    # Delete child packages first to avoid internal FK from packages/prices
                    ProductPackage.objects.filter(product=prod).delete()
                    prod.delete()
                    deleted += 1
            except IntegrityError:
                # FKs elsewhere (e.g., product_orders) — disable instead
                try:
                    prod.is_active = False
                    prod.save(update_fields=["is_active"])
                    ProductPackage.objects.filter(product=prod).update(is_active=False)
                    disabled += 1
                except Exception:
                    errors += 1
        msg_parts = []
        if deleted:
            msg_parts.append(f"محذوف: {deleted}")
        if disabled:
            msg_parts.append(f"مُعطّل: {disabled}")
        if errors:
            msg_parts.append(f"أخطاء: {errors}")
        self.message_user(request, " ، ".join(msg_parts) or "لا تغييرات")

    action_delete_if_unused.short_description = "حذف إن أمكن (وإلا تعطيل بأمان)"

    class ProductForm(forms.ModelForm):
        image_upload = forms.ImageField(required=False, label="صورة المنتج")

        class Meta:
            model = Product
            fields = ("name", "is_active")

        def save(self, commit=True):
            instance = super().save(commit=False)
            file = self.cleaned_data.get("image_upload")
            # Ensure we have a PK for deterministic file path
            # Important: ensure tenant_id is set BEFORE any initial save() to avoid NOT NULL violation
            if not getattr(instance, 'tenant_id', None):
                # Default to global catalog for admin-created products (can be adjusted later if needed)
                instance.tenant_id = GLOBAL_TENANT_ID
            if commit and instance.pk is None:
                instance.save()
            if file:
                import os
                from django.core.files.storage import default_storage
                base = f"{instance.pk or 'new'}_{instance.name}"
                safe_base = ''.join(c if c.isalnum() else '_' for c in base)[:80]
                _, ext = os.path.splitext(file.name)
                filename = f"products/{safe_base}{ext.lower()}"
                path = default_storage.save(filename, file)
                instance.custom_image_url = settings.MEDIA_URL + path
            if commit:
                instance.save()
            return instance

    form = ProductForm

    # Force display under Arabic app name only
    def get_model_perms(self, request):
        perms = super().get_model_perms(request)
        return perms

    def has_module_permission(self, request):
        # Delegate to mixin but ensure only one Arabic section appears
        return DevVisibleAdminMixin.has_module_permission(self, request)


@admin.register(ProductPackage)
class ProductPackageAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    """
    إدارة باقات المنتجات - معطل في Sidebar
    الباقات تُدار من داخل صفحة المنتج مباشرة (Inline)
    هذه الصفحة للبحث والعرض فقط
    """
    list_display = ("display_product_header", "name", "public_code", "base_price", "is_active")
    list_filter = ("is_active", ProductFilterForPackages)  # فلتر مخصص يعرض المنتجات الجديدة فقط
    search_fields = ("name", "public_code", "product__name")
    raw_id_fields = ("product",)
    ordering = ("product__name", "public_code")
    fields = ("name", "product", "public_code", "base_price", "capital", "is_active", "description")
    list_display_links = ("name",)
    
    # إخفاء من القائمة الجانبية
    def has_module_permission(self, request):
        # مخفي من Sidebar - استخدم المنتجات مباشرة
        return False
    
    def display_product_header(self, obj):
        """عرض اسم المنتج بتنسيق جميل"""
        from django.utils.html import format_html
        return format_html(
            '<strong style="color: #2196F3; font-size: 14px;">📦 {}</strong>',
            obj.product.name if obj.product else '---'
        )
    display_product_header.short_description = 'المنتج'
    display_product_header.admin_order_field = 'product__name'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Limit package admin to packages under GLOBAL products only
        # إضافة select_related لتحسين الأداء
        return qs.filter(product__tenant_id__in=[GLOBAL_TENANT_ID, None]).select_related('product')

    def save_model(self, request, obj, form, change):
        # Always inherit tenant_id from the selected product to ensure isolation
        try:
            if getattr(obj, 'product', None) and getattr(obj.product, 'tenant_id', None):
                obj.tenant_id = obj.product.tenant_id
        except Exception:
            pass
        super().save_model(request, obj, form, change)

    def has_module_permission(self, request):
        return DevVisibleAdminMixin.has_module_permission(self, request)


@admin.register(PriceGroup)
class PriceGroupAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    # Hide entirely from admin as requested
    def has_module_permission(self, request):
        return False

    def has_view_permission(self, request, obj=None):
        return False

    list_display = ("name", "tenant_id", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(PackagePrice)
class PackagePriceAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    # Hide entirely from admin as requested
    def has_module_permission(self, request):
        return False

    def has_view_permission(self, request, obj=None):
        return False

    list_display = ("id", "tenant_id", "package", "price_group", "price")
    raw_id_fields = ("package", "price_group")
    search_fields = ("id",)


# Define an inline to show packages under product
class ProductPackageInline(admin.TabularInline):
    model = ProductPackage
    extra = 1  # allow quick add at the top of the list
    can_delete = True
    show_change_link = True
    raw_id_fields = ("product",)
    fields = ("name", "product_name", "public_code", "is_active")
    readonly_fields = ("product_name",)

    def product_name(self, obj):
        return getattr(getattr(obj, 'product', None), 'name', '')
    product_name.short_description = "اسم المنتج"


# Attach the inline to ProductAdmin after class definition to avoid reordering decorators
ProductAdmin.inlines = [ProductPackageInline]