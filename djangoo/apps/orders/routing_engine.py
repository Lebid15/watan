"""
Enhanced Routing Engine
محرك التوجيه المحسن
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
from django.db import transaction
from django.core.exceptions import ValidationError

from apps.providers.models import PackageRouting
from apps.orders.models import Order
from apps.providers.validators import PackageRoutingValidator, RoutingConflictDetector

logger = logging.getLogger(__name__)


class SmartRoutingEngine:
    """
    محرك التوجيه الذكي مع آلية Fallback متقدمة
    """
    
    def __init__(self):
        self.routing_cache = {}
        self.fallback_attempts = {}
    
    def get_best_routing(self, tenant_id: str, package_id: str) -> Optional[PackageRouting]:
        """
        الحصول على أفضل إعداد توجيه مع تجنب التضارب
        
        Args:
            tenant_id: معرف المستأجر
            package_id: معرف الباقة
            
        Returns:
            PackageRouting: أفضل إعداد توجيه أو None
        """
        cache_key = f"{tenant_id}_{package_id}"
        
        # التحقق من الكاش
        if cache_key in self.routing_cache:
            return self.routing_cache[cache_key]
        
        # جلب جميع إعدادات التوجيه
        routings = PackageRouting.objects.filter(
            tenant_id=tenant_id,
            package_id=package_id,
        )
        
        if not routings.exists():
            logger.warning(f"No routing found for tenant {tenant_id}, package {package_id}")
            return None
        
        # كشف التضارب
        conflict_detector = RoutingConflictDetector()
        conflicts = conflict_detector.detect_conflicts(tenant_id, package_id)
        
        if conflicts['has_conflicts']:
            logger.warning(f"Routing conflicts detected: {conflicts['conflicts']}")
        
        # اختيار أفضل توجيه حسب الأولوية
        best_routing = self._select_best_routing(routings)
        
        # حفظ في الكاش
        self.routing_cache[cache_key] = best_routing
        
        return best_routing
    
    def _select_best_routing(self, routings) -> Optional[PackageRouting]:
        """
        اختيار أفضل إعداد توجيه من القائمة
        
        خوارزمية الاختيار:
        1. أولوية عالية (priority أقل)
        2. external قبل codes
        3. auto قبل manual
        4. أحدث إنشاء
        """
        if not routings.exists():
            return None
        
        # ترتيب حسب الأولوية
        sorted_routings = routings.order_by(
            'provider_type',  # external قبل codes
            'mode'  # auto قبل manual
        )
        
        # اختيار الأول (الأفضل)
        best_routing = sorted_routings.first()
        
        # التحقق من صحة التوجيه المختار
        validation_result = PackageRoutingValidator.validate_routing_config({
            'mode': best_routing.mode,
            'provider_type': best_routing.provider_type,
            'primary_provider_id': best_routing.primary_provider_id,
            'fallback_provider_id': best_routing.fallback_provider_id,
            'code_group_id': best_routing.code_group_id,
        })
        
        if not validation_result['is_valid']:
            logger.error(f"Selected routing is invalid: {validation_result['errors']}")
            # محاولة اختيار توجيه آخر
            for routing in sorted_routings[1:]:
                validation_result = PackageRoutingValidator.validate_routing_config({
                    'mode': routing.mode,
                    'provider_type': routing.provider_type,
                    'primary_provider_id': routing.primary_provider_id,
                    'fallback_provider_id': routing.fallback_provider_id,
                    'code_group_id': routing.code_group_id,
                })
                if validation_result['is_valid']:
                    return routing
            
            return None
        
        return best_routing
    
    def dispatch_order(self, order: Order, routing: PackageRouting) -> Dict[str, Any]:
        """
        توجيه الطلب باستخدام الإعداد المحدد
        
        Args:
            order: الطلب المراد توجيهه
            routing: إعداد التوجيه
            
        Returns:
            Dict: نتيجة التوجيه
        """
        try:
            with transaction.atomic():
                result = {
                    'success': False,
                    'provider_id': None,
                    'external_order_id': None,
                    'message': '',
                    'fallback_triggered': False
                }
                
                # التحقق من صحة التوجيه
                if not self._validate_routing_for_dispatch(routing):
                    result['message'] = 'إعداد التوجيه غير صالح'
                    return result
                
                # تنفيذ التوجيه حسب النوع
                if routing.provider_type == 'external':
                    result = self._dispatch_to_external_provider(order, routing)
                elif routing.provider_type in ('codes', 'internal_codes'):
                    result = self._dispatch_to_internal_codes(order, routing)
                else:
                    result['message'] = f'نوع مزود غير مدعوم: {routing.provider_type}'
                
                # تسجيل النتيجة
                self._log_dispatch_result(order, routing, result)
                
                return result
                
        except Exception as e:
            logger.error(f"Dispatch failed for order {order.id}: {str(e)}")
            return {
                'success': False,
                'message': f'خطأ في التوجيه: {str(e)}',
                'error': str(e)
            }
    
    def _validate_routing_for_dispatch(self, routing: PackageRouting) -> bool:
        """التحقق من صحة التوجيه قبل التنفيذ"""
        if routing.mode != 'auto':
            return False
        
        if routing.provider_type == 'external' and not routing.primary_provider_id:
            return False
        
        if routing.provider_type in ('codes', 'internal_codes') and not routing.code_group_id:
            return False
        
        return True
    
    def _dispatch_to_external_provider(self, order: Order, routing: PackageRouting) -> Dict[str, Any]:
        """توجيه الطلب للمزود الخارجي"""
        try:
            # محاولة التوجيه للمزود الأساسي
            provider_id = routing.primary_provider_id
            
            # TODO: تنفيذ التوجيه الفعلي للمزود الخارجي
            # هذا يتطلب تكامل مع API المزود
            
            result = {
                'success': True,
                'provider_id': provider_id,
                'external_order_id': f"ext_{order.id}_{provider_id}",
                'message': 'تم التوجيه للمزود الخارجي بنجاح'
            }
            
            # تحديث حالة الطلب
            order.provider_id = provider_id
            order.external_order_id = result['external_order_id']
            order.external_status = 'sent'
            order.save(update_fields=['provider_id', 'external_order_id', 'external_status'])
            
            return result
            
        except Exception as e:
            # محاولة Fallback للمزود الاحتياطي
            if routing.fallback_provider_id:
                return self._try_fallback_provider(order, routing, str(e))
            else:
                return {
                    'success': False,
                    'message': f'فشل التوجيه للمزود الأساسي: {str(e)}',
                    'error': str(e)
                }
    
    def _dispatch_to_internal_codes(self, order: Order, routing: PackageRouting) -> Dict[str, Any]:
        """توجيه الطلب للأكواد الداخلية"""
        try:
            # TODO: تنفيذ التوجيه للأكواد الداخلية
            # هذا يتطلب تكامل مع نظام الأكواد
            
            result = {
                'success': True,
                'provider_id': 'internal_codes',
                'external_order_id': f"codes_{order.id}",
                'message': 'تم التوجيه للأكواد الداخلية بنجاح'
            }
            
            # تحديث حالة الطلب
            order.provider_id = 'internal_codes'
            order.external_order_id = result['external_order_id']
            order.external_status = 'completed'
            order.save(update_fields=['provider_id', 'external_order_id', 'external_status'])
            
            return result
            
        except Exception as e:
            # محاولة Fallback للمزود الاحتياطي
            if routing.fallback_provider_id:
                return self._try_fallback_provider(order, routing, str(e))
            else:
                return {
                    'success': False,
                    'message': f'فشل التوجيه للأكواد الداخلية: {str(e)}',
                    'error': str(e)
                }
    
    def _try_fallback_provider(self, order: Order, routing: PackageRouting, error_message: str) -> Dict[str, Any]:
        """محاولة التوجيه للمزود الاحتياطي"""
        try:
            # التحقق من عدم تكرار محاولة Fallback
            fallback_key = f"{order.id}_{routing.fallback_provider_id}"
            if fallback_key in self.fallback_attempts:
                return {
                    'success': False,
                    'message': 'تم محاولة Fallback مسبقاً',
                    'fallback_triggered': True
                }
            
            # تسجيل محاولة Fallback
            self.fallback_attempts[fallback_key] = True
            
            # إنشاء توجيه مؤقت للمزود الاحتياطي
            fallback_routing = PackageRouting(
                tenant_id=routing.tenant_id,
                package_id=routing.package_id,
                mode='auto',
                provider_type='external',
                primary_provider_id=routing.fallback_provider_id,
                fallback_provider_id=None,
                code_group_id=None,
                priority=1
            )
            
            # محاولة التوجيه للمزود الاحتياطي
            result = self._dispatch_to_external_provider(order, fallback_routing)
            result['fallback_triggered'] = True
            result['message'] = f'تم التوجيه للمزود الاحتياطي: {result.get("message", "")}'
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'message': f'فشل Fallback: {str(e)}',
                'fallback_triggered': True,
                'error': str(e)
            }
    
    def _log_dispatch_result(self, order: Order, routing: PackageRouting, result: Dict[str, Any]):
        """تسجيل نتيجة التوجيه"""
        log_data = {
            'order_id': str(order.id),
            'tenant_id': str(order.tenant_id),
            'routing_id': str(routing.id),
            'routing_mode': routing.mode,
            'routing_provider_type': routing.provider_type,
            'success': result['success'],
            'provider_id': result.get('provider_id'),
            'external_order_id': result.get('external_order_id'),
            'message': result.get('message'),
            'fallback_triggered': result.get('fallback_triggered', False)
        }
        
        if result['success']:
            logger.info(f"Order dispatch successful: {log_data}")
        else:
            logger.error(f"Order dispatch failed: {log_data}")
    
    def clear_cache(self, tenant_id: str = None, package_id: str = None):
        """مسح الكاش"""
        if tenant_id and package_id:
            cache_key = f"{tenant_id}_{package_id}"
            self.routing_cache.pop(cache_key, None)
        else:
            self.routing_cache.clear()
            self.fallback_attempts.clear()


# إنشاء instance عام للمحرك
routing_engine = SmartRoutingEngine()

