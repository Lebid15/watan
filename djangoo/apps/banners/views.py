from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Banner
from .serializers import BannerSerializer


class BannerViewSet(viewsets.ModelViewSet):
    """
    ViewSet لإدارة صور السلايدر
    
    GET /api-dj/banners/ - قائمة الصور
    POST /api-dj/banners/ - إضافة صورة جديدة
    PATCH /api-dj/banners/{id}/ - تحديث صورة
    DELETE /api-dj/banners/{id}/ - حذف صورة
    GET /api-dj/banners/active/ - الصور النشطة فقط (للواجهة الأمامية)
    """
    
    queryset = Banner.objects.all()
    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]  # مؤقت - يجب تعديله لاحقاً للمصادقة
    
    def get_queryset(self):
        """
        فلترة الصور حسب المستأجر
        """
        tenant_id = getattr(self.request, 'tenant_id', None)
        
        # أو من الـ headers
        if not tenant_id:
            tenant_id = self.request.headers.get('X-Tenant-ID')
        
        # إرجاع جميع البانرات للمستأجر (نشطة وغير نشطة)
        queryset = Banner.objects.all()
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        return queryset.order_by('order')
    
    def perform_create(self, serializer):
        """
        إضافة tenant_id تلقائياً عند الإنشاء
        """
        tenant_id = getattr(self.request, 'tenant_id', None)
        if not tenant_id:
            tenant_id = self.request.headers.get('X-Tenant-ID')
        
        # التحقق من عدد البانرات
        existing_count = Banner.objects.filter(tenant_id=tenant_id).count()
        if existing_count >= 3:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'الحد الأقصى 3 صور فقط'})
        
        serializer.save(tenant_id=tenant_id)
    
    @extend_schema(
        summary="الحصول على الصور النشطة",
        description="جلب جميع صور السلايدر النشطة للمستأجر الحالي (حد أقصى 3) - للعرض في الصفحة الرئيسية",
        responses={200: BannerSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        endpoint مخصص للحصول على الصور النشطة فقط (للواجهة الأمامية)
        """
        try:
            tenant_id = getattr(request, 'tenant_id', None)
            if not tenant_id:
                tenant_id = request.headers.get('X-Tenant-ID')
            
            queryset = Banner.get_active_banners(tenant_id)
            serializer = self.get_serializer(queryset, many=True)
            
            return Response({
                'count': queryset.count(),
                'results': serializer.data
            })
        except Exception as e:
            # في حالة الخطأ، إرجاع قائمة فارغة
            return Response({
                'count': 0,
                'results': []
            })
