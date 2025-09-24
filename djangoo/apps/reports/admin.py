from __future__ import annotations

from django.contrib import admin
from django.conf import settings
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.template.response import TemplateResponse
from .models import ReportsIndex


class ReportsAdmin(admin.ModelAdmin):
    change_list_template = "admin/reports_change_list.html"

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

    def get_queryset(self, request):
        # Return an empty queryset to avoid DB access for the dummy model
        return ReportsIndex.objects.none()

    def changelist_view(self, request, extra_context=None):
        base_ctx = self.admin_site.each_context(request)
        opts = self.model._meta
        context = {
            **base_ctx,
            **(extra_context or {}),
            "title": "التقارير",
            "opts": opts,
            "app_label": opts.app_label,
        }
        return TemplateResponse(request, self.change_list_template, context)


# Register a dummy model to get a sidebar entry; uses custom template with links
admin.site.register(ReportsIndex, ReportsAdmin)