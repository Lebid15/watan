from __future__ import annotations

from django.contrib import admin
# from .models import SitePage


# قسم الصفحات (Pages) - معطل مؤقتاً
# السبب: لدينا نظام إشعارات أفضل للمستأجرين
# يمكن إعادة تفعيله لاحقاً إذا احتجناه

# @admin.register(SitePage)
# class SitePageAdmin(admin.ModelAdmin):
#     list_display = ("key", "tenant_id", "updated_at")
#     list_filter = ("key",)
#     search_fields = ("key", "content")
#     ordering = ("-updated_at",)
#     readonly_fields = ()

#     fieldsets = (
#         (None, {
#             "fields": ("tenant_id", "key", "content"),
#         }),
#         ("Metadata", {
#             "fields": ("updated_at",),
#         }),
#     )

