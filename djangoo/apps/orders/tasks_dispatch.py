"""
Celery task for dispatching orders to external providers (async).

This task sends orders to external providers in the background,
making the user experience much faster.
"""
import logging
from typing import Dict, Any
from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)


def try_auto_dispatch_sync_internal(order_id: str, tenant_id: str) -> Dict[str, Any]:
    """
    الدالة الداخلية المتزامنة لإرسال الطلب إلى المزود - تستدعى من Celery Task فقط
    هذه الدالة تستدعي الدالة الأصلية try_auto_dispatch من services.py
    """
    from apps.orders.services import try_auto_dispatch
    
    print(f"\n{'='*60}")
    print(f"🚀 [Background Task] إرسال الطلب #{order_id[:8]}... إلى المزود الخارجي")
    print(f"{'='*60}\n")
    
    try:
        # استدعاء الدالة الأصلية التي تحتوي على كل المنطق
        try_auto_dispatch(order_id, tenant_id)
        
        print(f"\n{'='*60}")
        print(f"✅ [Background Task] تم إرسال الطلب بنجاح!")
        print(f"{'='*60}\n")
        
        return {'dispatched': True}
        
    except Exception as e:
        print(f"\n❌ [Background Task] خطأ في إرسال الطلب: {str(e)}")
        logger.exception(f"Error dispatching order {order_id}")
        raise


@shared_task(
    bind=True,
    max_retries=3,  # إعادة المحاولة 3 مرات فقط عند إرسال الطلب
    default_retry_delay=10,
    retry_backoff=True,
)
def send_order_to_provider_async(self, order_id: str, tenant_id: str):
    """
    إرسال الطلب إلى المزود الخارجي في الخلفية (async).
    
    هذا الـ task يعمل بشكل غير متزامن، مما يجعل التطبيق أسرع بكثير.
    المستخدم يحصل على استجابة فورية، والطلب يُرسل في الخلفية.
    
    Args:
        order_id: UUID الطلب
        tenant_id: UUID المستأجر
        
    Returns:
        dict: نتيجة الإرسال
    """
    print(f"\n{'='*100}")
    print(f"🚀 [Async Task] إرسال الطلب إلى المزود الخارجي...")
    print(f"   Order ID: {order_id[:8]}...")
    print(f"   Tenant ID: {tenant_id[:8]}...")
    print(f"{'='*100}\n")
    
    try:
        result = try_auto_dispatch_sync_internal(order_id, tenant_id)
        
        print(f"\n{'='*100}")
        print(f"✅ [Async Task] تم إرسال الطلب بنجاح!")
        print(f"   Order ID: {order_id[:8]}...")
        print(f"   External Order ID: {result.get('externalOrderId', 'N/A')}")
        print(f"{'='*100}\n")
        
        logger.info(f"✅ Async dispatch successful for order {order_id}")
        return result
        
    except Exception as exc:
        print(f"\n{'='*100}")
        print(f"❌ [Async Task] خطأ في إرسال الطلب!")
        print(f"   Order ID: {order_id[:8]}...")
        print(f"   Error: {exc}")
        print(f"   سيتم إعادة المحاولة...")
        print(f"{'='*100}\n")
        
        logger.error(f"❌ Async dispatch failed for order {order_id}: {exc}")
        
        # إعادة المحاولة تلقائياً
        raise self.retry(exc=exc, countdown=10)
