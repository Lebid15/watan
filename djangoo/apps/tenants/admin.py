from __future__ import annotations

from django.contrib import admin
from django.conf import settings
from .models import Tenant, TenantDomain


class DevVisibleAdminMixin:
    def has_module_permission(self, request):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        if getattr(settings, 'DEBUG', False) and request.user and request.user.is_staff:
            return True
        return super().has_view_permission(request, obj)


@admin.register(Tenant)
class TenantAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("id", "name")


@admin.register(TenantDomain)
class TenantDomainAdmin(DevVisibleAdminMixin, admin.ModelAdmin):
    list_display = ("domain", "tenant_id", "is_primary")
    list_filter = ("is_primary",)
    search_fields = ("domain",)