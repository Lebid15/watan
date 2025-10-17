from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import DashboardAnnouncement
from .serializers import (
    DashboardAnnouncementSerializer,
    DashboardAnnouncementPublicSerializer
)


class DashboardAnnouncementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet للإعلانات - للمستأجرين (القراءة فقط)
    
    GET /api-dj/dashboard/announcements/ - قائمة الإعلانات
    GET /api-dj/dashboard/announcements/{id}/ - تفاصيل إعلان
    GET /api-dj/dashboard/announcements/active/ - الإعلانات النشطة فقط
    """
    
    queryset = DashboardAnnouncement.objects.all()
    serializer_class = DashboardAnnouncementPublicSerializer
    permission_classes = [permissions.AllowAny]  # السماح للجميع بالقراءة
    
    def get_queryset(self):
        """
        فلترة الإعلانات حسب المستأجر
        - إذا كان المستخدم لديه tenant_id في الطلب، يجلب الإعلانات العامة + الخاصة به
        - وإلا يجلب الإعلانات العامة فقط
        """
        # محاولة الحصول على tenant_id من الـ request
        tenant_id = getattr(self.request, 'tenant_id', None)
        
        # أو من الـ headers
        if not tenant_id:
            tenant_id = self.request.headers.get('X-Tenant-ID')
        
        # استخدام الدالة المساعدة في الـ Model
        return DashboardAnnouncement.get_active_for_tenant(tenant_id)
    
    @extend_schema(
        summary="الحصول على الإعلانات النشطة",
        description="جلب جميع الإعلانات النشطة والمرئية للمستأجر الحالي",
        responses={200: DashboardAnnouncementPublicSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    # @method_decorator(cache_page(60 * 5))  # Cache معطل مؤقتاً للاختبار
    def active(self, request):
        """
        endpoint مخصص للحصول على الإعلانات النشطة فقط
        """
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            
            return Response({
                'count': queryset.count(),
                'results': serializer.data
            })
        except Exception as e:
            # في حالة أي خطأ، نرجع قائمة فارغة
            return Response({
                'count': 0,
                'results': [],
                'error': str(e)
            })
    
    @extend_schema(
        summary="إحصائيات الإعلانات",
        description="الحصول على إحصائيات عن الإعلانات",
        responses={200: {
            'type': 'object',
            'properties': {
                'total': {'type': 'integer'},
                'by_type': {'type': 'object'},
                'global': {'type': 'integer'},
                'tenant_specific': {'type': 'integer'},
            }
        }}
    )
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        إحصائيات عن الإعلانات النشطة
        """
        queryset = self.get_queryset()
        
        stats = {
            'total': queryset.count(),
            'by_type': {},
            'global': queryset.filter(is_global=True).count(),
            'tenant_specific': queryset.filter(is_global=False).count(),
        }
        
        # إحصاء حسب النوع
        for announcement_type, _ in DashboardAnnouncement.ANNOUNCEMENT_TYPES:
            count = queryset.filter(announcement_type=announcement_type).count()
            if count > 0:
                stats['by_type'][announcement_type] = count
        
        return Response(stats)


class DashboardAnnouncementAdminViewSet(viewsets.ModelViewSet):
    """
    ViewSet للإدارة - CRUD كامل (للـ Admins فقط)
    
    يستخدم هذا من Django Admin أو من واجهات إدارية خاصة
    """
    
    queryset = DashboardAnnouncement.objects.all()
    serializer_class = DashboardAnnouncementSerializer
    permission_classes = [permissions.IsAdminUser]
    
    def perform_create(self, serializer):
        """حفظ المستخدم الذي أنشأ الإعلان"""
        serializer.save(created_by=self.request.user)
    
    @extend_schema(
        summary="تبديل حالة التفعيل",
        description="تفعيل أو تعطيل إعلان بسرعة",
        responses={200: DashboardAnnouncementSerializer}
    )
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """تبديل حالة is_active بسرعة"""
        announcement = self.get_object()
        announcement.is_active = not announcement.is_active
        announcement.save()
        
        serializer = self.get_serializer(announcement)
        return Response(serializer.data)
