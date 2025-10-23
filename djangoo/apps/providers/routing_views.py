"""
Enhanced Routing API Views
واجهات API محسنة للتوجيه
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from django.core.exceptions import ValidationError

from .models import PackageRouting
from .serializers import PackageRoutingSerializer
from .validators import PackageRoutingValidator, RoutingHealthChecker
from apps.orders.routing_engine import routing_engine
from apps.orders.routing_monitor import routing_monitor


class RoutingDashboardView(APIView):
    """
    لوحة تحكم التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Dashboard"],
        summary="لوحة تحكم التوجيه",
        description="عرض إحصائيات ومراقبة نظام التوجيه"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            dashboard = routing_monitor.get_routing_dashboard(str(tenant_id))
            return Response(dashboard)
        except Exception as e:
            return Response(
                {'error': f'Failed to load dashboard: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingHealthView(APIView):
    """
    فحص صحة نظام التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Health"],
        summary="فحص صحة التوجيه",
        description="فحص شامل لصحة نظام التوجيه"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            health_report = routing_monitor.generate_health_report(str(tenant_id))
            return Response(health_report)
        except Exception as e:
            return Response(
                {'error': f'Failed to generate health report: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingValidationView(APIView):
    """
    التحقق من صحة إعدادات التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Validation"],
        summary="التحقق من صحة التوجيه",
        description="التحقق من صحة إعدادات التوجيه قبل الحفظ"
    )
    def post(self, request):
        routing_data = request.data
        
        try:
            validation_result = PackageRoutingValidator.validate_routing_config(routing_data)
            return Response(validation_result)
        except Exception as e:
            return Response(
                {'error': f'Validation failed: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class RoutingConflictDetectionView(APIView):
    """
    كشف تضارب إعدادات التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Conflicts"],
        summary="كشف التضارب",
        description="كشف تضارب إعدادات التوجيه"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        package_id = request.query_params.get('package_id')
        
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not package_id:
            return Response(
                {'error': 'Package ID is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .validators import RoutingConflictDetector
            conflict_detector = RoutingConflictDetector()
            conflicts = conflict_detector.detect_conflicts(tenant_id, package_id)
            return Response(conflicts)
        except Exception as e:
            return Response(
                {'error': f'Failed to detect conflicts: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingAnalyticsView(APIView):
    """
    تحليلات التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Analytics"],
        summary="تحليلات التوجيه",
        description="تحليلات مفصلة لنظام التوجيه"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        days = int(request.query_params.get('days', 30))
        
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            analytics = routing_monitor.get_routing_analytics(str(tenant_id), days)
            return Response(analytics)
        except Exception as e:
            return Response(
                {'error': f'Failed to generate analytics: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SmartRoutingView(APIView):
    """
    التوجيه الذكي
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Smart Routing"],
        summary="التوجيه الذكي",
        description="توجيه ذكي مع آلية Fallback"
    )
    def post(self, request):
        order_id = request.data.get('order_id')
        tenant_id = getattr(request.user, 'tenant_id', None)
        
        if not order_id:
            return Response(
                {'error': 'Order ID is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from apps.orders.models import Order
            
            # جلب الطلب
            try:
                order = Order.objects.get(id=order_id, tenant_id=tenant_id)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # الحصول على أفضل توجيه
            routing = routing_engine.get_best_routing(str(tenant_id), str(order.package_id))
            
            if not routing:
                return Response(
                    {'error': 'No routing configuration found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # تنفيذ التوجيه
            result = routing_engine.dispatch_order(order, routing)
            
            return Response(result)
            
        except Exception as e:
            return Response(
                {'error': f'Smart routing failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingBulkValidationView(APIView):
    """
    التحقق الجماعي من إعدادات التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Bulk Validation"],
        summary="التحقق الجماعي",
        description="التحقق من صحة جميع إعدادات التوجيه"
    )
    def post(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # جلب جميع إعدادات التوجيه
            routings = PackageRouting.objects.filter(tenant_id=tenant_id)
            
            validation_results = []
            for routing in routings:
                routing_data = {
                    'mode': routing.mode,
                    'provider_type': routing.provider_type,
                    'primary_provider_id': routing.primary_provider_id,
                    'fallback_provider_id': routing.fallback_provider_id,
                    'code_group_id': routing.code_group_id,
                }
                
                validation_result = PackageRoutingValidator.validate_routing_config(routing_data)
                validation_results.append({
                    'routing_id': str(routing.id),
                    'package_id': str(routing.package_id),
                    'validation': validation_result
                })
            
            return Response({
                'total_routings': len(validation_results),
                'valid_routings': len([r for r in validation_results if r['validation']['is_valid']]),
                'invalid_routings': len([r for r in validation_results if not r['validation']['is_valid']]),
                'results': validation_results
            })
            
        except Exception as e:
            return Response(
                {'error': f'Bulk validation failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

