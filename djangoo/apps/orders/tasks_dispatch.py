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
    from apps.orders.models import ProductOrder
    
    print(f"\n{'='*60}")
    print(f"🚀 [Background Task] إرسال الطلب #{order_id[:8]}... إلى المزود الخارجي")
    print(f"{'='*60}\n")
    
    try:
        # حفظ حالة الطلب قبل التنفيذ
        order_before = ProductOrder.objects.get(id=order_id)
        status_before = order_before.status
        provider_before = order_before.provider_id
        note_before = order_before.manual_note
        
        # استدعاء الدالة الأصلية التي تحتوي على كل المنطق
        try_auto_dispatch(order_id, tenant_id)
        
        # فحص إذا تغيّر الطلب فعلياً
        order_after = ProductOrder.objects.get(id=order_id)
        status_changed = order_after.status != status_before
        provider_changed = order_after.provider_id != provider_before
        note_changed = order_after.manual_note != note_before
        
        dispatched = status_changed or provider_changed or note_changed
        
        if dispatched:
            print(f"\n{'='*60}")
            print(f"✅ [Background Task] تم إرسال الطلب بنجاح!")
            print(f"   - Status: {status_before} → {order_after.status}")
            print(f"   - Provider: {provider_before} → {order_after.provider_id}")
            print(f"   - Note: {'Updated' if note_changed else 'No change'}")
            print(f"{'='*60}\n")
        else:
            print(f"\n{'='*60}")
            print(f"⚠️ [Background Task] لم يتم إرسال الطلب (لا يوجد تغيير)")
            print(f"   - Status: {status_before}")
            print(f"   - Provider: {provider_before}")
            print(f"{'='*60}\n")
        
        return {'dispatched': dispatched}
        
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
