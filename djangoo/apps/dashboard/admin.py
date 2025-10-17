from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import DashboardAnnouncement


@admin.register(DashboardAnnouncement)
class DashboardAnnouncementAdmin(admin.ModelAdmin):
    list_display = (
        'title_colored',
        'announcement_type_badge',
        'scope_badge',
        'is_active_badge',
        'order',
        'date_status',
        'created_at',
    )
    
    list_filter = (
        'is_active',
        'is_global',
        'announcement_type',
        'created_at',
    )
    
    search_fields = (
        'title',
        'content',
        'tenant_id',
    )
    
    ordering = ('order', '-created_at')
    
    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
        'created_by',
    )
    
    list_editable = ('order',)
    
    fieldsets = (
        ('المعلومات الأساسية', {
            'fields': (
                'title',
                'content',
                'announcement_type',
                'icon',
            )
        }),
        ('الإعدادات', {
            'fields': (
                'order',
                'is_active',
                'is_global',
                'tenant_id',
            )
        }),
        ('الجدولة (اختياري)', {
            'fields': (
                'start_date',
                'end_date',
            ),
            'classes': ('collapse',),
        }),
        ('معلومات النظام', {
            'fields': (
                'id',
                'created_by',
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """حفظ المستخدم الذي أنشأ الإعلان"""
        if not change:  # إذا كان إنشاء جديد
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
    
    def title_colored(self, obj):
        """عرض العنوان بلون حسب النوع"""
        colors = {
            'info': '#3b82f6',
            'success': '#10b981',
            'warning': '#f59e0b',
            'update': '#8b5cf6',
            'announcement': '#06b6d4',
        }
        color = colors.get(obj.announcement_type, '#6b7280')
        return format_html(
            '<strong style="color: {};">{}</strong>',
            color,
            obj.title
        )
    title_colored.short_description = 'العنوان'
    
    def announcement_type_badge(self, obj):
        """عرض نوع الإعلان كـ badge"""
        colors = {
            'info': '#3b82f6',
            'success': '#10b981',
            'warning': '#f59e0b',
            'update': '#8b5cf6',
            'announcement': '#06b6d4',
        }
        color = colors.get(obj.announcement_type, '#6b7280')
        label = dict(obj.ANNOUNCEMENT_TYPES).get(obj.announcement_type, obj.announcement_type)
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color,
            label
        )
    announcement_type_badge.short_description = 'النوع'
    
    def scope_badge(self, obj):
        """عرض نطاق الإعلان (عام/خاص)"""
        if obj.is_global:
            return format_html(
                '<span style="background-color: #10b981; color: white; padding: 3px 10px; '
                'border-radius: 12px; font-size: 11px;">🌍 عام</span>'
            )
        else:
            return format_html(
                '<span style="background-color: #f59e0b; color: white; padding: 3px 10px; '
                'border-radius: 12px; font-size: 11px;">🔒 خاص</span>'
            )
    scope_badge.short_description = 'النطاق'
    
    def is_active_badge(self, obj):
        """عرض حالة التفعيل"""
        if obj.is_active:
            return format_html(
                '<span style="color: #10b981; font-weight: bold;">✓ نشط</span>'
            )
        else:
            return format_html(
                '<span style="color: #ef4444; font-weight: bold;">✗ معطل</span>'
            )
    is_active_badge.short_description = 'الحالة'
    
    def date_status(self, obj):
        """عرض حالة التواريخ"""
        now = timezone.now()
        
        if obj.start_date and now < obj.start_date:
            return format_html(
                '<span style="color: #f59e0b;">⏳ قريباً</span>'
            )
        elif obj.end_date and now > obj.end_date:
            return format_html(
                '<span style="color: #ef4444;">⏱️ منتهي</span>'
            )
        elif obj.is_visible_now():
            return format_html(
                '<span style="color: #10b981;">✓ مرئي</span>'
            )
        else:
            return format_html(
                '<span style="color: #6b7280;">—</span>'
            )
    date_status.short_description = 'حالة العرض'
    
    def get_queryset(self, request):
        """تحسين الاستعلام"""
        qs = super().get_queryset(request)
        return qs.select_related('created_by')
    
    class Media:
        css = {
            'all': ('admin/css/dashboard_announcements.css',)
        }
