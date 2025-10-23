"""
Routing Monitoring System
نظام مراقبة التوجيه
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from django.db.models import Count, Q, Avg
from django.utils import timezone

from apps.orders.models import Order
from apps.providers.models import PackageRouting
from apps.providers.validators import RoutingHealthChecker

logger = logging.getLogger(__name__)


class RoutingMonitor:
    """
    نظام مراقبة التوجيه مع تقارير مفصلة
    """
    
    def __init__(self):
        self.health_checker = RoutingHealthChecker()
    
    def get_routing_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        """
        لوحة تحكم شاملة لنظام التوجيه
        
        Args:
            tenant_id: معرف المستأجر
            
        Returns:
            Dict: بيانات لوحة التحكم
        """
        dashboard = {
            'overview': self._get_overview_stats(tenant_id),
            'routing_health': self.health_checker.check_routing_health(tenant_id),
            'recent_issues': self._get_recent_issues(tenant_id),
            'performance_metrics': self._get_performance_metrics(tenant_id),
            'recommendations': self._get_recommendations(tenant_id)
        }
        
        return dashboard
    
    def _get_overview_stats(self, tenant_id: str) -> Dict[str, Any]:
        """إحصائيات عامة"""
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        
        # إحصائيات الطلبات
        total_orders = Order.objects.filter(tenant_id=tenant_id).count()
        pending_orders = Order.objects.filter(
            tenant_id=tenant_id,
            status='pending',
            external_order_id__isnull=True
        ).count()
        
        orders_24h = Order.objects.filter(
            tenant_id=tenant_id,
            created_at__gte=last_24h
        ).count()
        
        orders_7d = Order.objects.filter(
            tenant_id=tenant_id,
            created_at__gte=last_7d
        ).count()
        
        # إحصائيات التوجيه
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
        
        return {
            'orders': {
                'total': total_orders,
                'pending': pending_orders,
                'last_24h': orders_24h,
                'last_7d': orders_7d,
                'pending_percentage': (pending_orders / total_orders * 100) if total_orders > 0 else 0
            },
            'routings': {
                'total': total_routings,
                'active': active_routings,
                'auto': auto_routings,
                'manual': manual_routings,
                'auto_percentage': (auto_routings / active_routings * 100) if active_routings > 0 else 0
            }
        }
    
    def _get_recent_issues(self, tenant_id: str) -> List[Dict[str, Any]]:
        """المشاكل الأخيرة"""
        issues = []
        
        # الطلبات المعلقة لفترة طويلة
        old_pending_orders = Order.objects.filter(
            tenant_id=tenant_id,
            status='pending',
            external_order_id__isnull=True,
            created_at__lt=timezone.now() - timedelta(hours=2)
        ).count()
        
        if old_pending_orders > 0:
            issues.append({
                'type': 'old_pending_orders',
                'severity': 'high',
                'message': f'يوجد {old_pending_orders} طلب معلق لأكثر من ساعتين',
                'count': old_pending_orders,
                'suggestion': 'راجع إعدادات التوجيه أو وجّه الطلبات يدوياً'
            })
        
        # التوجيهات المعطلة
        inactive_routings = PackageRouting.objects.filter(
            tenant_id=tenant_id,
            is_active=False
        ).count()
        
        if inactive_routings > 0:
            issues.append({
                'type': 'inactive_routings',
                'severity': 'medium',
                'message': f'يوجد {inactive_routings} توجيه معطل',
                'count': inactive_routings,
                'suggestion': 'فعّل التوجيهات أو احذفها'
            })
        
        # التوجيهات بدون مزود
        routings_without_provider = PackageRouting.objects.filter(
            tenant_id=tenant_id,
            mode='auto',
            provider_type='external',
            primary_provider_id__isnull=True,
            is_active=True
        ).count()
        
        if routings_without_provider > 0:
            issues.append({
                'type': 'routings_without_provider',
                'severity': 'high',
                'message': f'يوجد {routings_without_provider} توجيه تلقائي بدون مزود',
                'count': routings_without_provider,
                'suggestion': 'أضف مزود أساسي أو غيّر الوضع ليدوي'
            })
        
        return issues
    
    def _get_performance_metrics(self, tenant_id: str) -> Dict[str, Any]:
        """مقاييس الأداء"""
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        
        # معدل نجاح التوجيه
        successful_orders = Order.objects.filter(
            tenant_id=tenant_id,
            external_order_id__isnull=False,
            created_at__gte=last_24h
        ).count()
        
        total_orders_24h = Order.objects.filter(
            tenant_id=tenant_id,
            created_at__gte=last_24h
        ).count()
        
        success_rate = (successful_orders / total_orders_24h * 100) if total_orders_24h > 0 else 0
        
        # متوسط وقت التوجيه
        dispatched_orders = Order.objects.filter(
            tenant_id=tenant_id,
            external_order_id__isnull=False,
            sent_at__isnull=False,
            created_at__gte=last_24h
        )
        
        if dispatched_orders.exists():
            # حساب متوسط الوقت بين الإنشاء والإرسال
            avg_dispatch_time = 0  # TODO: حساب متوسط الوقت الفعلي
        else:
            avg_dispatch_time = 0
        
        return {
            'success_rate': round(success_rate, 2),
            'avg_dispatch_time_minutes': round(avg_dispatch_time, 2),
            'total_orders_24h': total_orders_24h,
            'successful_orders_24h': successful_orders
        }
    
    def _get_recommendations(self, tenant_id: str) -> List[str]:
        """التوصيات لتحسين النظام"""
        recommendations = []
        
        # فحص صحة النظام
        health = self.health_checker.check_routing_health(tenant_id)
        
        if not health['is_healthy']:
            recommendations.append('يوجد مشاكل في إعدادات التوجيه - راجع التقرير التفصيلي')
        
        # فحص نسبة التوجيه التلقائي
        overview = self._get_overview_stats(tenant_id)
        auto_percentage = overview['routings']['auto_percentage']
        
        if auto_percentage < 50:
            recommendations.append('فكر في زيادة نسبة التوجيه التلقائي لتحسين الكفاءة')
        
        # فحص الطلبات المعلقة
        pending_orders = overview['orders']['pending']
        if pending_orders > 10:
            recommendations.append('يوجد طلبات معلقة كثيرة - راجع إعدادات التوجيه')
        
        return recommendations
    
    def get_routing_analytics(self, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        """
        تحليلات مفصلة لنظام التوجيه
        
        Args:
            tenant_id: معرف المستأجر
            days: عدد الأيام للتحليل
            
        Returns:
            Dict: تحليلات مفصلة
        """
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # تحليل حسب نوع التوجيه
        routing_analysis = {}
        
        for provider_type in ['external', 'internal_codes', 'manual']:
            orders = Order.objects.filter(
                tenant_id=tenant_id,
                created_at__gte=start_date,
                created_at__lte=end_date
            )
            
            if provider_type == 'external':
                orders = orders.filter(external_order_id__isnull=False)
            elif provider_type == 'internal_codes':
                orders = orders.filter(provider_id='internal_codes')
            else:
                orders = orders.filter(
                    external_order_id__isnull=True,
                    provider_id__isnull=True
                )
            
            routing_analysis[provider_type] = {
                'count': orders.count(),
                'percentage': (orders.count() / Order.objects.filter(
                    tenant_id=tenant_id,
                    created_at__gte=start_date,
                    created_at__lte=end_date
                ).count() * 100) if Order.objects.filter(
                    tenant_id=tenant_id,
                    created_at__gte=start_date,
                    created_at__lte=end_date
                ).exists() else 0
            }
        
        # تحليل الأداء اليومي
        daily_performance = []
        for i in range(days):
            date = start_date + timedelta(days=i)
            next_date = date + timedelta(days=1)
            
            daily_orders = Order.objects.filter(
                tenant_id=tenant_id,
                created_at__gte=date,
                created_at__lt=next_date
            )
            
            successful_orders = daily_orders.filter(
                external_order_id__isnull=False
            ).count()
            
            daily_performance.append({
                'date': date.strftime('%Y-%m-%d'),
                'total_orders': daily_orders.count(),
                'successful_orders': successful_orders,
                'success_rate': (successful_orders / daily_orders.count() * 100) if daily_orders.count() > 0 else 0
            })
        
        return {
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'routing_analysis': routing_analysis,
            'daily_performance': daily_performance
        }
    
    def generate_health_report(self, tenant_id: str) -> Dict[str, Any]:
        """
        تقرير صحة شامل لنظام التوجيه
        
        Args:
            tenant_id: معرف المستأجر
            
        Returns:
            Dict: تقرير الصحة
        """
        health_report = {
            'tenant_id': tenant_id,
            'generated_at': timezone.now().isoformat(),
            'overall_health': 'unknown',
            'issues': [],
            'recommendations': [],
            'metrics': {}
        }
        
        # فحص صحة النظام
        health = self.health_checker.check_routing_health(tenant_id)
        health_report['overall_health'] = 'healthy' if health['is_healthy'] else 'unhealthy'
        health_report['issues'].extend(health['issues'])
        
        # إضافة المقاييس
        health_report['metrics'] = self._get_performance_metrics(tenant_id)
        
        # إضافة التوصيات
        health_report['recommendations'] = self._get_recommendations(tenant_id)
        
        return health_report


# إنشاء instance عام للمراقب
routing_monitor = RoutingMonitor()

