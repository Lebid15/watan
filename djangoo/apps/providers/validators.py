"""
PackageRouting Validation System
نظام التحقق من صحة إعدادات التوجيه
"""

from django.core.exceptions import ValidationError
from django.db import models
from typing import Optional, Dict, Any


class PackageRoutingValidator:
    """فئة للتحقق من صحة إعدادات التوجيه"""
    
    @staticmethod
    def validate_routing_config(routing_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        التحقق من صحة إعدادات التوجيه
        
        Args:
            routing_data: بيانات التوجيه المراد التحقق منها
            
        Returns:
            Dict: نتائج التحقق مع الرسائل والأخطاء
            
        Raises:
            ValidationError: عند وجود أخطاء في الإعدادات
        """
        errors = []
        warnings = []
        
        mode = routing_data.get('mode', '').strip().lower()
        provider_type = routing_data.get('provider_type', '').strip().lower()
        primary_provider_id = routing_data.get('primary_provider_id')
        fallback_provider_id = routing_data.get('fallback_provider_id')
        code_group_id = routing_data.get('code_group_id')
        
        # 1. التحقق من التضارب بين mode و provider_type
        if mode == 'auto' and provider_type == 'manual':
            errors.append({
                'field': 'provider_type',
                'message': 'لا يمكن استخدام وضع تلقائي مع نوع مزود يدوي',
                'suggestion': 'غيّر provider_type إلى external أو internal_codes'
            })
        
        # 2. التحقق من وجود مزود أساسي للتوجيه الخارجي
        if mode == 'auto' and provider_type == 'external':
            if not primary_provider_id:
                errors.append({
                    'field': 'primary_provider_id',
                    'message': 'التوجيه التلقائي الخارجي يتطلب مزود أساسي',
                    'suggestion': 'أضف primary_provider_id صالح'
                })
        
        # 3. التحقق من وجود مجموعة أكواد للتوجيه الداخلي
        if mode == 'auto' and provider_type in ('codes', 'internal_codes'):
            if not code_group_id:
                errors.append({
                    'field': 'code_group_id',
                    'message': 'التوجيه التلقائي الداخلي يتطلب مجموعة أكواد',
                    'suggestion': 'أضف code_group_id صالح'
                })
        
        # 4. التحقق من صحة المزود الاحتياطي
        if fallback_provider_id and not primary_provider_id:
            warnings.append({
                'field': 'fallback_provider_id',
                'message': 'وجود مزود احتياطي بدون مزود أساسي',
                'suggestion': 'أضف primary_provider_id أو احذف fallback_provider_id'
            })
        
        # 5. التحقق من عدم تكرار المزود الأساسي والاحتياطي
        if primary_provider_id and fallback_provider_id:
            if primary_provider_id == fallback_provider_id:
                errors.append({
                    'field': 'fallback_provider_id',
                    'message': 'المزود الأساسي والاحتياطي لا يمكن أن يكونا نفس المزود',
                    'suggestion': 'اختر مزود احتياطي مختلف'
                })
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'suggestions': PackageRoutingValidator._generate_suggestions(routing_data)
        }
    
    @staticmethod
    def _generate_suggestions(routing_data: Dict[str, Any]) -> Dict[str, str]:
        """إنتاج اقتراحات لتحسين الإعدادات"""
        suggestions = {}
        
        mode = routing_data.get('mode', '').strip().lower()
        provider_type = routing_data.get('provider_type', '').strip().lower()
        
        if mode == 'manual':
            suggestions['optimization'] = 'لتحسين الأداء، فكر في استخدام التوجيه التلقائي'
        
        if provider_type == 'external' and not routing_data.get('fallback_provider_id'):
            suggestions['reliability'] = 'لزيادة الموثوقية، أضف مزود احتياطي'
        
        if provider_type in ('codes', 'internal_codes'):
            suggestions['monitoring'] = 'تأكد من مراقبة مخزون الأكواد بانتظام'
        
        return suggestions


class RoutingConflictDetector:
    """كاشف تضارب إعدادات التوجيه"""
    
    @staticmethod
    def detect_conflicts(tenant_id: str, package_id: str) -> Dict[str, Any]:
        """
        كشف التضارب في إعدادات التوجيه
        
        Args:
            tenant_id: معرف المستأجر
            package_id: معرف الباقة
            
        Returns:
            Dict: تقرير التضارب
        """
        from .models import PackageRouting
        
        routings = PackageRouting.objects.filter(
            tenant_id=tenant_id,
            package_id=package_id
        )
        
        if routings.count() <= 1:
            return {'has_conflicts': False, 'conflicts': []}
        
        conflicts = []
        
        # كشف التضارب في الأولوية
        external_routings = routings.filter(provider_type='external')
        codes_routings = routings.filter(provider_type='codes')
        
        if external_routings.exists() and codes_routings.exists():
            conflicts.append({
                'type': 'priority_conflict',
                'message': 'يوجد توجيه خارجي وداخلي لنفس الباقة',
                'external_count': external_routings.count(),
                'codes_count': codes_routings.count(),
                'suggestion': 'احذف التوجيه غير المرغوب أو غيّر الأولوية'
            })
        
        # كشف التضارب في المزودين
        primary_providers = set()
        for routing in routings:
            if routing.primary_provider_id:
                if routing.primary_provider_id in primary_providers:
                    conflicts.append({
                        'type': 'duplicate_provider',
                        'message': f'المزود {routing.primary_provider_id} مكرر',
                        'routing_id': str(routing.id),
                        'suggestion': 'احذف التكرار أو غيّر المزود'
                    })
                primary_providers.add(routing.primary_provider_id)
        
        return {
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts,
            'total_routings': routings.count()
        }


class RoutingHealthChecker:
    """فحص صحة نظام التوجيه"""
    
    @staticmethod
    def check_routing_health(tenant_id: str) -> Dict[str, Any]:
        """
        فحص صحة نظام التوجيه للمستأجر
        
        Args:
            tenant_id: معرف المستأجر
            
        Returns:
            Dict: تقرير صحة النظام
        """
        from .models import PackageRouting
        from apps.orders.models import Order
        
        issues = []
        stats = {}
        
        # إحصائيات عامة
        total_routings = PackageRouting.objects.filter(tenant_id=tenant_id).count()
        auto_routings = PackageRouting.objects.filter(
            tenant_id=tenant_id, 
            mode='auto'
        ).count()
        manual_routings = PackageRouting.objects.filter(
            tenant_id=tenant_id, 
            mode='manual'
        ).count()
        
        stats.update({
            'total_routings': total_routings,
            'auto_routings': auto_routings,
            'manual_routings': manual_routings,
            'auto_percentage': (auto_routings / total_routings * 100) if total_routings > 0 else 0
        })
        
        # فحص التضارب
        conflict_detector = RoutingConflictDetector()
        for routing in PackageRouting.objects.filter(tenant_id=tenant_id):
            conflicts = conflict_detector.detect_conflicts(
                tenant_id, 
                str(routing.package_id)
            )
            if conflicts['has_conflicts']:
                issues.extend(conflicts['conflicts'])
        
        # فحص الطلبات المعلقة
        pending_orders = Order.objects.filter(
            tenant_id=tenant_id,
            status='pending',
            external_order_id__isnull=True
        ).count()
        
        if pending_orders > 0:
            issues.append({
                'type': 'pending_orders',
                'message': f'يوجد {pending_orders} طلب معلق بدون توجيه',
                'severity': 'high',
                'suggestion': 'راجع إعدادات التوجيه أو وجّه الطلبات يدوياً'
            })
        
        return {
            'is_healthy': len(issues) == 0,
            'issues': issues,
            'stats': stats,
            'recommendations': RoutingHealthChecker._generate_recommendations(stats, issues)
        }
    
    @staticmethod
    def _generate_recommendations(stats: Dict, issues: list) -> list[str]:
        """إنتاج توصيات لتحسين النظام"""
        recommendations = []
        
        if stats.get('auto_percentage', 0) < 50:
            recommendations.append('فكر في زيادة نسبة التوجيه التلقائي لتحسين الكفاءة')
        
        if len(issues) > 5:
            recommendations.append('يوجد مشاكل كثيرة - راجع إعدادات التوجيه بعناية')
        
        return recommendations

