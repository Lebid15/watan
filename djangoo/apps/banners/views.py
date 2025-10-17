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
        # الحصول على tenant_id من request.tenant (من middleware)
        tenant_obj = getattr(self.request, 'tenant', None)
        tenant_id = getattr(tenant_obj, 'id', None) if tenant_obj else None
        
        # إذا لم يتم تحديد المستأجر، إرجاع قائمة فارغة (أمان إضافي)
        if not tenant_id:
            return Banner.objects.none()
        
        # إرجاع البانرات للمستأجر فقط (نشطة وغير نشطة)
        return Banner.objects.filter(tenant_id=tenant_id).order_by('order')
    
    def perform_create(self, serializer):
        """
        إضافة tenant_id تلقائياً عند الإنشاء
        """
        # الحصول على tenant_id من request.tenant (من middleware)
        tenant_obj = getattr(self.request, 'tenant', None)
        tenant_id = getattr(tenant_obj, 'id', None) if tenant_obj else None
        
        if not tenant_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'تعذر تحديد المستأجر'})
        
        # التحقق من عدد البانرات
        existing_count = Banner.objects.filter(tenant_id=tenant_id).count()
        if existing_count >= 3:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'الحد الأقصى 3 صور فقط'})
        
        serializer.save(tenant_id=tenant_id)
    
    def perform_update(self, serializer):
        """
        التأكد من أن المستأجر يحدث بانراته فقط
        """
        # الحصول على tenant_id من request.tenant
        tenant_obj = getattr(self.request, 'tenant', None)
        current_tenant_id = getattr(tenant_obj, 'id', None) if tenant_obj else None
        
        # التأكد من أن البانر يخص نفس المستأجر
        instance = self.get_object()
        if str(instance.tenant_id) != str(current_tenant_id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied({'detail': 'غير مصرح لك بتعديل هذا البانر'})
        
        serializer.save()
    
    def perform_destroy(self, instance):
        """
        التأكد من أن المستأجر يحذف بانراته فقط
        """
        # الحصول على tenant_id من request.tenant
        tenant_obj = getattr(self.request, 'tenant', None)
        current_tenant_id = getattr(tenant_obj, 'id', None) if tenant_obj else None
        
        # التأكد من أن البانر يخص نفس المستأجر
        if str(instance.tenant_id) != str(current_tenant_id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied({'detail': 'غير مصرح لك بحذف هذا البانر'})
        
        instance.delete()
    
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
            # الحصول على tenant_id من request.tenant (من middleware)
            tenant_obj = getattr(request, 'tenant', None)
            tenant_id = getattr(tenant_obj, 'id', None) if tenant_obj else None
            
            # إذا لم يتم تحديد المستأجر، إرجاع قائمة فارغة
            if not tenant_id:
                return Response({
                    'count': 0,
                    'results': []
                })
            
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
