from __future__ import annotations

from django.contrib import admin
from django.conf import settings
# Legacy models from old NestJS backend - kept for reference only, NOT registered in admin
# from .models import Tenant, TenantDomain


# Legacy admin classes - DISABLED
# These models are from the old NestJS backend (tenant, tenant_domain tables)
# We use apps.tenancy.models.Tenant for the new Django-based tenant management

# class DevVisibleAdminMixin:
#     """Show this legacy app only for staff in DEBUG and make it read-only."""

#     def has_module_permission(self, request):
#         # Visible only in DEBUG to reduce confusion in production
#         if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
#             return True
#         return False

#     def has_view_permission(self, request, obj=None):
#         if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
#             return True
#         return False

#     def has_add_permission(self, request):
#         return False

#     def has_change_permission(self, request, obj=None):
#         # Allow viewing change form but fields will be read-only
#         return getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff

#     def has_delete_permission(self, request, obj=None):
#         return False

#     def get_readonly_fields(self, request, obj=None):
#         return [f.name for f in self.model._meta.fields]


# @admin.register(Tenant)
# class TenantAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
#     list_display = ("id", "name", "is_active")
#     list_filter = ("is_active",)
#     search_fields = ("id", "name")


# @admin.register(TenantDomain)
# class TenantDomainAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
#     list_display = ("domain", "tenant_id", "is_primary")
#     list_filter = ("is_primary",)
#     search_fields = ("domain",)


"""
NOTE: Legacy tenant models from old NestJS backend are NOT registered in Django admin.

- Tenant (table: 'tenant') - legacy tenant model
- TenantDomain (table: 'tenant_domain') - legacy domain model

For new tenant management, use: apps.tenancy.models.Tenant (table: 'dj_tenants')
These legacy models are kept in models.py for reference only.
"""
