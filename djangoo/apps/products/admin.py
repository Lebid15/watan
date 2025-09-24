from __future__ import annotations

from django.contrib import admin
from django.conf import settings
from .models import Product, ProductPackage, PriceGroup, PackagePrice


class DevVisibleAdminMixin:
    def has_module_permission(self, request):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_view_permission(request, obj)


@admin.register(Product)
class ProductAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("name", "tenant_id", "is_active", "source_global_product_id")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("name",)


@admin.register(ProductPackage)
class ProductPackageAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("name", "tenant_id", "product", "public_code", "provider_name", "is_active")
    list_filter = ("is_active", "provider_name")
    search_fields = ("name", "public_code", "provider_name")
    raw_id_fields = ("product",)
    ordering = ("name",)


@admin.register(PriceGroup)
class PriceGroupAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("name", "tenant_id", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(PackagePrice)
class PackagePriceAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("id", "tenant_id", "package", "price_group", "price")
    raw_id_fields = ("package", "price_group")
    search_fields = ("id",)