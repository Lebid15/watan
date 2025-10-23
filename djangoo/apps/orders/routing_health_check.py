"""
Enhanced Routing Health Check System
نظام فحص صحة التوجيه المحسن
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from django.db.models import Count, Q
from django.utils import timezone

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration

logger = logging.getLogger(__name__)


class RoutingHealthChecker:
    """
    فاحص صحة نظام التوجيه مع تقارير مفصلة
    """
    
    def __init__(self):
        self.health_cache = {}
        self.last_check = None
    
    def check_routing_health(self, tenant_id: str) -> Dict[str, Any]:
        """
        فحص شامل لصحة نظام التوجيه
        
        Args:
            tenant_id: معرف المستأجر
            
        Returns:
            Dict: تقرير صحة النظام
        """
        cache_key = f"health_{tenant_id}"
        
        # التحقق من الكاش
        if cache_key in self.health_cache:
            cache_time = self.health_cache[cache_key].get('timestamp')
            if cache_time and (timezone.now() - cache_time).seconds < 300:  # 5 دقائق
                return self.health_cache[cache_key]
        
        try:
            health_report = {
                'tenant_id': tenant_id,
                'timestamp': timezone.now(),
                'overall_health': 'unknown',
                'issues': [],
                'recommendations': [],
                'metrics': {},
                'routing_stats': {},
                'order_stats': {}
            }
            
            # فحص إعدادات التوجيه
            routing_issues = self._check_routing_configurations(tenant_id)
            health_report['issues'].extend(routing_issues)
            
            # فحص الطلبات المعلقة
            order_issues = self._check_pending_orders(tenant_id)
            health_report['issues'].extend(order_issues)
            
            # إحصائيات التوجيه
            routing_stats = self._get_routing_statistics(tenant_id)
            health_report['routing_stats'] = routing_stats
            
            # إحصائيات الطلبات
            order_stats = self._get_order_statistics(tenant_id)
            health_report['order_stats'] = order_stats
            
            # تحديد الصحة العامة
            health_report['overall_health'] = self._determine_overall_health(health_report['issues'])
            
            # إنتاج التوصيات
            health_report['recommendations'] = self._generate_recommendations(health_report)
            
            # حفظ في الكاش
            self.health_cache[cache_key] = health_report
            
            return health_report
            
        except Exception as e:
            logger.error(f"Health check failed for tenant {tenant_id}: {str(e)}")
            return {
                'tenant_id': tenant_id,
                'timestamp': timezone.now(),
                'overall_health': 'error',
                'issues': [{'type': 'health_check_error', 'message': str(e)}],
                'recommendations': ['إعادة تشغيل فحص الصحة'],
                'metrics': {},
                'routing_stats': {},
                'order_stats': {}
            }
    
    def _check_routing_configurations(self, tenant_id: str) -> List[Dict[str, Any]]:
        """فحص إعدادات التوجيه"""
        issues = []
        
        try:
            # فحص التضارب في الإعدادات
            conflicting_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                mode='auto',
                provider_type='manual'
            )
            
            if conflicting_routings.exists():
                issues.append({
                    'type': 'routing_conflict',
                    'severity': 'high',
                    'message': f'يوجد {conflicting_routings.count()} توجيه متضارب (auto + manual)',
                    'count': conflicting_routings.count(),
                    'suggestion': 'إصلاح التضارب أو تغيير الوضع'
                })
            
            # فحص التوجيهات بدون مزود
            routings_without_provider = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                mode='auto',
                provider_type='external',
                primary_provider_id__isnull=True
            )
            
            if routings_without_provider.exists():
                issues.append({
                    'type': 'routing_without_provider',
                    'severity': 'high',
                    'message': f'يوجد {routings_without_provider.count()} توجيه تلقائي بدون مزود',
                    'count': routings_without_provider.count(),
                    'suggestion': 'إضافة مزود أساسي أو تغيير الوضع ليدوي'
                })
            
            # فحص التوجيهات بدون مجموعة أكواد
            routings_without_codes = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                mode='auto',
                provider_type__in=['codes', 'internal_codes'],
                code_group_id__isnull=True
            )
            
            if routings_without_codes.exists():
                issues.append({
                    'type': 'routing_without_codes',
                    'severity': 'high',
                    'message': f'يوجد {routings_without_codes.count()} توجيه أكواد بدون مجموعة',
                    'count': routings_without_codes.count(),
                    'suggestion': 'إضافة مجموعة أكواد أو تغيير نوع المزود'
                })
            
            # فحص التوجيهات المعطلة
            inactive_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                is_active=False
            )
            
            if inactive_routings.exists():
                issues.append({
                    'type': 'inactive_routings',
                    'severity': 'medium',
                    'message': f'يوجد {inactive_routings.count()} توجيه معطل',
                    'count': inactive_routings.count(),
                    'suggestion': 'تفعيل التوجيهات أو حذفها'
                })
            
        except Exception as e:
            issues.append({
                'type': 'routing_check_error',
                'severity': 'high',
                'message': f'خطأ في فحص إعدادات التوجيه: {str(e)}',
                'suggestion': 'مراجعة إعدادات قاعدة البيانات'
            })
        
        return issues
    
    def _check_pending_orders(self, tenant_id: str) -> List[Dict[str, Any]]:
        """فحص الطلبات المعلقة"""
        issues = []
        
        try:
            # الطلبات المعلقة لفترة طويلة
            old_pending_orders = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                status='pending',
                external_order_id__isnull=True,
                created_at__lt=timezone.now() - timedelta(hours=2)
            )
            
            if old_pending_orders.exists():
                issues.append({
                    'type': 'old_pending_orders',
                    'severity': 'high',
                    'message': f'يوجد {old_pending_orders.count()} طلب معلق لأكثر من ساعتين',
                    'count': old_pending_orders.count(),
                    'suggestion': 'مراجعة إعدادات التوجيه أو التوجيه اليدوي'
                })
            
            # الطلبات المعلقة بدون توجيه
            pending_without_routing = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                status='pending',
                external_order_id__isnull=True,
                provider_id__isnull=True
            )
            
            if pending_without_routing.exists():
                issues.append({
                    'type': 'pending_without_routing',
                    'severity': 'medium',
                    'message': f'يوجد {pending_without_routing.count()} طلب معلق بدون توجيه',
                    'count': pending_without_routing.count(),
                    'suggestion': 'إعداد توجيه تلقائي أو التوجيه اليدوي'
                })
            
        except Exception as e:
            issues.append({
                'type': 'order_check_error',
                'severity': 'medium',
                'message': f'خطأ في فحص الطلبات: {str(e)}',
                'suggestion': 'مراجعة إعدادات قاعدة البيانات'
            })
        
        return issues
    
    def _get_routing_statistics(self, tenant_id: str) -> Dict[str, Any]:
        """إحصائيات التوجيه"""
        try:
            total_routings = PackageRouting.objects.filter(tenant_id=tenant_id).count()
            active_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                is_active=True
            ).count()
            
            auto_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                mode='auto',
                is_active=True
            ).count()
            
            manual_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                mode='manual',
                is_active=True
            ).count()
            
            external_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                provider_type='external',
                is_active=True
            ).count()
            
            codes_routings = PackageRouting.objects.filter(
                tenant_id=tenant_id,
                provider_type__in=['codes', 'internal_codes'],
                is_active=True
            ).count()
            
            return {
                'total': total_routings,
                'active': active_routings,
                'auto': auto_routings,
                'manual': manual_routings,
                'external': external_routings,
                'codes': codes_routings,
                'auto_percentage': (auto_routings / active_routings * 100) if active_routings > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get routing statistics: {str(e)}")
            return {}
    
    def _get_order_statistics(self, tenant_id: str) -> Dict[str, Any]:
        """إحصائيات الطلبات"""
        try:
            now = timezone.now()
            last_24h = now - timedelta(hours=24)
            last_7d = now - timedelta(days=7)
            
            total_orders = ProductOrder.objects.filter(tenant_id=tenant_id).count()
            pending_orders = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                status='pending',
                external_order_id__isnull=True
            ).count()
            
            orders_24h = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                created_at__gte=last_24h
            ).count()
            
            orders_7d = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                created_at__gte=last_7d
            ).count()
            
            successful_orders = ProductOrder.objects.filter(
                tenant_id=tenant_id,
                external_order_id__isnull=False,
                created_at__gte=last_24h
            ).count()
            
            success_rate = (successful_orders / orders_24h * 100) if orders_24h > 0 else 0
            
            return {
                'total': total_orders,
                'pending': pending_orders,
                'last_24h': orders_24h,
                'last_7d': orders_7d,
                'successful_24h': successful_orders,
                'success_rate': round(success_rate, 2),
                'pending_percentage': (pending_orders / total_orders * 100) if total_orders > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get order statistics: {str(e)}")
            return {}
    
    def _determine_overall_health(self, issues: List[Dict[str, Any]]) -> str:
        """تحديد الصحة العامة"""
        if not issues:
            return 'healthy'
        
        high_severity_issues = [issue for issue in issues if issue.get('severity') == 'high']
        if high_severity_issues:
            return 'critical'
        
        medium_severity_issues = [issue for issue in issues if issue.get('severity') == 'medium']
        if medium_severity_issues:
            return 'warning'
        
        return 'healthy'
    
    def _generate_recommendations(self, health_report: Dict[str, Any]) -> List[str]:
        """إنتاج التوصيات"""
        recommendations = []
        
        # توصيات بناءً على المشاكل
        for issue in health_report['issues']:
            if issue.get('type') == 'routing_conflict':
                recommendations.append('إصلاح التضارب في إعدادات التوجيه')
            elif issue.get('type') == 'routing_without_provider':
                recommendations.append('إضافة مزودين أساسيين للتوجيه التلقائي')
            elif issue.get('type') == 'old_pending_orders':
                recommendations.append('مراجعة الطلبات المعلقة وإعدادات التوجيه')
        
        # توصيات بناءً على الإحصائيات
        routing_stats = health_report.get('routing_stats', {})
        if routing_stats.get('auto_percentage', 0) < 50:
            recommendations.append('زيادة نسبة التوجيه التلقائي لتحسين الكفاءة')
        
        order_stats = health_report.get('order_stats', {})
        if order_stats.get('success_rate', 0) < 80:
            recommendations.append('تحسين معدل نجاح التوجيه')
        
        if order_stats.get('pending_percentage', 0) > 20:
            recommendations.append('تقليل نسبة الطلبات المعلقة')
        
        return recommendations
    
    def clear_cache(self, tenant_id: str = None):
        """مسح الكاش"""
        if tenant_id:
            cache_key = f"health_{tenant_id}"
            self.health_cache.pop(cache_key, None)
        else:
            self.health_cache.clear()


# إنشاء instance عام
routing_health_checker = RoutingHealthChecker()

