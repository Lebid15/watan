from __future__ import annotations

from django.contrib import admin
from django.conf import settings
from .models import ProductOrder, LegacyUser, Product, ProductPackage


class DevVisibleAdminMixin:
    def has_module_permission(self, request):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_view_permission(request, obj)


@admin.register(ProductOrder)
class ProductOrderAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("order_no", "tenant_id", "status", "sell_price_currency", "sell_price_amount", "created_at")
    list_filter = ("status", "sell_price_currency")
    search_fields = ("order_no", "external_order_id", "user_identifier")
    date_hierarchy = "created_at"
    raw_id_fields = ("user", "product", "package")


@admin.register(LegacyUser)
class LegacyUserAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("email", "username", "tenant_id")
    search_fields = ("email", "username")


@admin.register(Product)
class ProductRefAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(ProductPackage)
class ProductPackageRefAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "product_id")
    search_fields = ("name",)