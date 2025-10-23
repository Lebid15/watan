"""
Routing Health Check API Views
واجهات API لفحص صحة التوجيه
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .routing_health_check import routing_health_checker


class RoutingHealthCheckView(APIView):
    """
    فحص صحة نظام التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Health"],
        summary="فحص صحة التوجيه",
        description="فحص شامل لصحة نظام التوجيه مع تقارير مفصلة"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            health_report = routing_health_checker.check_routing_health(str(tenant_id))
            return Response(health_report)
        except Exception as e:
            return Response(
                {'error': f'Health check failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingHealthSummaryView(APIView):
    """
    ملخص صحة التوجيه
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Health"],
        summary="ملخص صحة التوجيه",
        description="ملخص سريع لصحة نظام التوجيه"
    )
    def get(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        if not tenant_id:
            return Response(
                {'error': 'Tenant ID not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            health_report = routing_health_checker.check_routing_health(str(tenant_id))
            
            # إنتاج ملخص مبسط
            summary = {
                'tenant_id': tenant_id,
                'overall_health': health_report.get('overall_health', 'unknown'),
                'issues_count': len(health_report.get('issues', [])),
                'critical_issues': len([i for i in health_report.get('issues', []) if i.get('severity') == 'high']),
                'recommendations_count': len(health_report.get('recommendations', [])),
                'routing_stats': health_report.get('routing_stats', {}),
                'order_stats': health_report.get('order_stats', {}),
                'timestamp': health_report.get('timestamp')
            }
            
            return Response(summary)
        except Exception as e:
            return Response(
                {'error': f'Health summary failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoutingHealthClearCacheView(APIView):
    """
    مسح كاش فحص الصحة
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=["Routing Health"],
        summary="مسح كاش الصحة",
        description="مسح كاش فحص الصحة لإجبار إعادة الفحص"
    )
    def post(self, request):
        tenant_id = getattr(request.user, 'tenant_id', None)
        
        try:
            routing_health_checker.clear_cache(tenant_id)
            return Response({'message': 'Cache cleared successfully'})
        except Exception as e:
            return Response(
                {'error': f'Cache clear failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

