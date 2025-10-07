from __future__ import annotations

from django.contrib import admin
from django.conf import settings
# Legacy models from old NestJS backend - kept for reference only, NOT registered in admin
# from .models import ProductOrder, LegacyUser, Product, ProductPackage


# Legacy admin classes - DISABLED
# These models are from the old NestJS backend and should not be managed through Django admin
# We keep the models.py file for reference to understand the old schema structure

# class DevVisibleAdminMixin:
#     def has_module_permission(self, request):
#         if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
#             return True
#         return super().has_module_permission(request)

#     def has_view_permission(self, request, obj=None):
#         if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
#             return True
#         return super().has_view_permission(request, obj)


# @admin.register(ProductOrder)
# class ProductOrderAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
#     list_display = ("order_no", "tenant_id", "status", "sell_price_currency", "sell_price_amount", "created_at")
#     list_filter = ("status", "sell_price_currency")
#     search_fields = ("order_no", "external_order_id", "user_identifier")
#     date_hierarchy = "created_at"
#     raw_id_fields = ("user", "product", "package")


# @admin.register(LegacyUser)
# class LegacyUserAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
#     list_display = ("email", "username", "tenant_id")
#     search_fields = ("email", "username")


"""
NOTE: Legacy models from old NestJS backend (Product, ProductPackage, ProductOrder, LegacyUser)
are intentionally NOT registered in Django admin.

- Product and ProductPackage are fully managed in apps.products.admin with Arabic labels
- LegacyUser and ProductOrder are kept in models.py for reference only
- All new development should use Django models (dj_users, dj_products, etc.)
"""