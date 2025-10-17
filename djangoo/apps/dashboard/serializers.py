from __future__ import annotations

from rest_framework import serializers
from .models import DashboardAnnouncement


class DashboardAnnouncementSerializer(serializers.ModelSerializer):
    """Serializer للإعلانات - يُستخدم في API"""
    
    type_display = serializers.CharField(
        source='get_announcement_type_display',
        read_only=True
    )
    
    is_visible = serializers.SerializerMethodField()
    
    created_by_name = serializers.SerializerMethodField()
    
    content = serializers.SerializerMethodField()
    
    class Meta:
        model = DashboardAnnouncement
        fields = [
            'id',
            'title',
            'content',
            'announcement_type',
            'type_display',
            'icon',
            'order',
            'is_active',
            'is_global',
            'tenant_id',
            'start_date',
            'end_date',
            'is_visible',
            'created_at',
            'updated_at',
            'created_by_name',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]
    
    def get_content(self, obj) -> str:
        """تحويل السطور الجديدة إلى <br> tags"""
        if not obj.content:
            return ""
        # تحويل \r\n و \n إلى <br>
        content = obj.content.replace('\r\n', '<br>').replace('\n', '<br>')
        return content
    
    def get_is_visible(self, obj) -> bool:
        """حساب إذا كان الإعلان مرئي حالياً"""
        return obj.is_visible_now()
    
    def get_created_by_name(self, obj) -> str | None:
        """اسم المستخدم الذي أنشأ الإعلان"""
        if obj.created_by:
            return getattr(obj.created_by, 'username', None) or str(obj.created_by)
        return None


class DashboardAnnouncementPublicSerializer(serializers.ModelSerializer):
    """Serializer مبسط للعرض العام (للمستأجرين)"""
    
    type_display = serializers.CharField(
        source='get_announcement_type_display',
        read_only=True
    )
    
    content = serializers.SerializerMethodField()
    
    class Meta:
        model = DashboardAnnouncement
        fields = [
            'id',
            'title',
            'content',
            'announcement_type',
            'type_display',
            'icon',
            'order',
            'created_at',
        ]
    
    def get_content(self, obj) -> str:
        """تحويل السطور الجديدة إلى <br> tags"""
        if not obj.content:
            return ""
        # تحويل \r\n و \n إلى <br>
        content = obj.content.replace('\r\n', '<br>').replace('\n', '<br>')
        return content
