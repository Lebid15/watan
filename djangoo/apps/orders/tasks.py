"""
Celery tasks for order status monitoring and updates.

This module contains background tasks that check order status from external providers
and update the order database accordingly.
"""
from typing import Optional

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from .models import ProductOrder
from apps.providers.models import PackageRouting
from apps.providers.adapters import resolve_adapter_credentials
from .services import (
    apply_order_status_change,
    OrderStatusError,
    TenantMismatchError,
    LegacyUserMissingError,
    OverdraftExceededError,
)

logger = logging.getLogger(__name__)


# -- Mapping helpers -------------------------------------------------------

_EXTERNAL_FINAL_STATUS_MAP = {
    'completed': 'done',
    'done': 'done',
    'success': 'done',
    'delivered': 'done',
    'approved': 'done',
    'failed': 'failed',
    'fail': 'failed',
    'error': 'failed',
    'rejected': 'failed',
    'reject': 'failed',
    'cancelled': 'failed',
    'canceled': 'failed',
}


def _normalize_external_status(raw_status: Optional[str], fallback: str) -> str:
    key = (raw_status or '').strip().lower()
    if not key:
        return fallback
    return _EXTERNAL_FINAL_STATUS_MAP.get(key, key)


@shared_task(
    bind=True,
    max_retries=288,  # تكفي لـ 48 ساعة (يومين) مع retry_backoff
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,  # Maximum 10 minutes between retries
    retry_jitter=True,
)
def check_order_status(self, order_id: str, tenant_id: str, attempt: int = 1):
    """
    Check the status of a single order from the external provider.
    
    This task will automatically retry with exponential backoff until the order
    reaches a final status (completed, failed, etc.) or exceeds 24 hours.
    
    Args:
        order_id: UUID of the order
        tenant_id: UUID of the tenant
        attempt: Current attempt number (for logging)
    
    Returns:
        dict: Status information about the order
    """
    print(f"\n{'='*100}")
    print(f"🔍 [محاولة #{attempt}] فحص حالة الطلب: {order_id[:8]}...")
    print(f"{'='*100}")
    logger.info(f"🔍 [Attempt {attempt}] Checking status for order: {order_id}")
    
    try:
        # 1. Fetch the order
        try:
            order = ProductOrder.objects.using('default').get(
                id=order_id,
                tenant_id=tenant_id
            )
        except ProductOrder.DoesNotExist:
            logger.error(f"❌ Order {order_id} not found in database")
            return {'order_id': order_id, 'status': 'error', 'message': 'Order not found'}
        
        # 2. Check if order is already in final state
        final_statuses = ['completed', 'delivered', 'cancelled', 'canceled', 'failed', 'rejected', 'done']
        if order.external_status in final_statuses:
            print(f"✅ الطلب في حالة نهائية: {order.external_status}")
            print(f"   الحالة الداخلية: {order.status}")
            print(f"{'='*100}\n")
            logger.info(f"✅ Order {order_id} already in final state: {order.external_status}")
            return {
                'order_id': order_id,
                'status': order.external_status,
                'message': 'Already in final state'
            }
        
        # 3. Check if order has exceeded 24-hour timeout
        if order.sent_at:
            time_since_sent = timezone.now() - order.sent_at
            if time_since_sent > timedelta(hours=24):
                logger.warning(f"⏰ Order {order_id} exceeded 24h, marking as failed")
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("""
                        UPDATE product_orders
                        SET "externalStatus" = 'failed',
                            "lastMessage" = %s,
                            "lastSyncAt" = %s
                        WHERE id = %s
                    """, [
                        (order.last_message or '') + ' | Timeout: No response after 24h',
                        timezone.now(),
                        str(order.id)
                    ])
                return {
                    'order_id': order_id,
                    'status': 'failed',
                    'message': 'Timeout after 24 hours'
                }
        
        # 4. Get reference for status check (use external_order_id or order id as fallback)
        referans = getattr(order, 'provider_referans', None) or order.external_order_id or str(order.id)
        if not referans:
            logger.error(f"❌ Order {order_id} missing reference for status check")
            return {
                'order_id': order_id,
                'status': 'error',
                'message': 'Missing reference ID'
            }
        
        # 5. Get provider information
        package = order.package
        if not package:
            logger.error(f"❌ Order {order_id} has no package")
            return {'order_id': order_id, 'status': 'error', 'message': 'No package'}
        
        routing = PackageRouting.objects.using('default').filter(
            package_id=package.id,
            tenant_id=tenant_id
        ).first()
        
        if not routing or not routing.primary_provider_id:
            logger.error(f"❌ No routing found for order {order_id}")
            return {'order_id': order_id, 'status': 'error', 'message': 'No routing'}
        
        # Get Integration from primary_provider_id
        from apps.providers.models import Integration
        integration = Integration.objects.get(id=routing.primary_provider_id)
        
        # For internal provider, use order.id as reference (it's stored as providerReferans in target tenant)
        # For other providers, use external_order_id or provider_referans
        if integration.provider == 'internal':
            referans = str(order.id)
        
        # 6. Get provider binding and credentials
        binding, creds = resolve_adapter_credentials(
            integration.provider,
            base_url=integration.base_url,
            api_token=getattr(integration, 'api_token', None),
            kod=getattr(integration, 'kod', None),
            sifre=getattr(integration, 'sifre', None),
        )
        
        if not binding or not creds:
            logger.error(f"❌ Could not resolve adapter credentials for order {order_id}")
            return {'order_id': order_id, 'status': 'error', 'message': 'No credentials'}
        
        print(f"\n📡 استعلام عن حالة الطلب من المزود: {integration.provider}")
        print(f"   المرجع: {referans}")
        print(f"   الحالة الحالية: {order.external_status or 'غير محددة'}")
        
        logger.info(f"📡 Fetching status from {integration.provider} for referans: {referans}")
        
        # 7. Call adapter to fetch status
        result = binding.adapter.fetch_status(creds, referans)
        
        print(f"\n📥 استجابة المزود:")
        print(f"   الحالة: {result.get('status', 'N/A')}")
        if result.get('pinCode'):
            print(f"   PIN Code: {result.get('pinCode')[:10]}...")
        if result.get('message'):
            print(f"   الرسالة: {result.get('message')}")
        
        logger.info(f"📥 Provider response: {result}")
        
        # 8. Update order status
        old_status = order.external_status
        old_order_status = order.status
        new_status = result.get('status')
        pin_code = result.get('pinCode')
        message = result.get('message') or result.get('note')
        
        print(f"\n📊 Current State:")
        print(f"   - Current external_status: {old_status}")
        print(f"   - Current order status: {old_order_status}")
        print(f"   - New status from provider: {new_status}")
        print(f"   - PIN Code from provider: {pin_code}")
        print(f"   - Message from provider: {message}")
        
        # Map external_status to order status
        order_status_map = {
            'completed': 'approved',
            'done': 'approved',
            'success': 'approved',
            'delivered': 'approved',
            'approved': 'approved',
            'accept': 'approved',
            'accepted': 'approved',
            'failed': 'rejected',
            'rejected': 'rejected',
            'error': 'rejected',
            'cancelled': 'rejected',
            'canceled': 'rejected',  # US spelling
        }
        
        print(f"\n🗺️ Status Mapping:")
        print(f"   - Available mappings: {order_status_map}")
        
        # Build update query
        from django.db import connection
        update_fields = []
        update_values = []
        
        canonical_external_status = _normalize_external_status(new_status, old_status or 'processing')
        new_order_status = order_status_map.get((new_status or '').lower(), old_order_status)

        print(f"\n🔄 معالجة الحالة:")
        print(f"   📌 الحالة من المزود: {new_status or 'N/A'}")
        print(f"   📌 الحالة المطبّعة: {canonical_external_status}")
        print(f"   📌 الحالة الداخلية الجديدة: {new_order_status}")
        print(f"   📊 الحالة الحالية: {old_order_status}")
        
        if new_status and new_status != old_status:
            print(f"   ✨ تغيير في الحالة: {old_status} → {new_status}")
        else:
            print(f"   ⏸️  لا تغيير في الحالة")
        
        status_transition_needed = new_order_status in ('approved', 'rejected') and new_order_status != old_order_status

        if status_transition_needed:
            try:
                cancellation_reason = ""
                cancellation_reason_ar = ""
                if new_order_status == 'rejected':
                    if (new_status or '').lower() in ('cancelled', 'canceled'):
                        cancellation_reason = " (cancelled by provider)"
                        cancellation_reason_ar = " (تم الإلغاء من المزود)"
                    elif (new_status or '').lower() in ('failed', 'error'):
                        cancellation_reason = " (failed)"
                        cancellation_reason_ar = " (فشل)"
                
                print(f"\n⚙️ تطبيق انتقال الحالة{cancellation_reason_ar}:")
                print(f"   من: {old_order_status} → إلى: {new_order_status}")
                print(f"   سيتم تحديث الرصيد...")
                
                logger.info(
                    f"⚙️ Applying balance transition via apply_order_status_change{cancellation_reason}",
                    extra={
                        "order_id": str(order.id),
                        "tenant_id": str(order.tenant_id),
                        "from": old_order_status,
                        "to": new_order_status,
                        "provider_status": new_status,
                    },
                )
                apply_order_status_change(
                    order_id=str(order.id),
                    next_status=new_order_status,
                    expected_tenant_id=str(order.tenant_id),
                    note=message,  # ✅ تمرير الملاحظة من المزود
                )
                order.refresh_from_db()
                old_order_status = order.status
                old_status = order.external_status
                canonical_external_status = order.external_status or canonical_external_status
                
                print(f"   ✅ نجح تحديث الحالة والرصيد")
                print(f"   الحالة النهائية: {order.status}")
                
                logger.info(
                    "✅ apply_order_status_change succeeded",
                    extra={
                        "order_id": str(order.id),
                        "status": order.status,
                        "external_status": order.external_status,
                    },
                )
            except (OrderStatusError, TenantMismatchError, LegacyUserMissingError, OverdraftExceededError) as status_exc:
                print(f"   ⚠️ تعذر تطبيق الانتقال الكامل: {str(status_exc)}")
                print(f"   سيتم التحديث المباشر بدلاً من ذلك")
                
                logger.warning(
                    "⚠️ apply_order_status_change could not complete, falling back to direct update",
                    extra={
                        "order_id": str(order.id),
                        "error": str(status_exc),
                        "from": old_order_status,
                        "to": new_order_status,
                    },
                )
                update_fields.append('status = %s')
                update_values.append(new_order_status)
            except Exception as unexpected_exc:  # noqa: BLE001
                logger.exception(
                    "❌ Unexpected failure from apply_order_status_change",
                    extra={
                        "order_id": str(order.id),
                        "error": str(unexpected_exc),
                    },
                )
                update_fields.append('status = %s')
                update_values.append(new_order_status)
        elif new_status and new_status != old_status:
            # Non-terminal change – persist the mapped external status only
            update_fields.append('"externalStatus" = %s')
            update_values.append(canonical_external_status)
            print(f"\n🔄 تحديث الحالة الخارجية فقط: {old_status} → {canonical_external_status}")
            logger.info(f"🔄 External Status changed: {old_status} → {canonical_external_status}")

        # Ensure we persist the canonical external status when terminal transition already handled by apply()
        if status_transition_needed:
            update_fields.append('"externalStatus" = %s')
            update_values.append(canonical_external_status)
        else:
            print(f"\n⚠️ External status NOT changing:")
            if not new_status:
                print(f"   - Reason: No status in provider response")
            elif new_status == old_status:
                print(f"   - Reason: Same as current ({old_status})")
        
        if pin_code and pin_code != order.pin_code:
            update_fields.append('"pinCode" = %s')
            update_values.append(pin_code)
            print(f"🔑 استلام PIN Code: {pin_code[:10]}...")
            logger.info(f"🔑 PIN Code received: {pin_code[:10]}...")
        
        if message:
            new_message = (order.last_message or '') + f" | {message}"
            update_fields.append('"lastMessage" = %s')
            update_values.append(new_message[:250])
            
            # ✅ تحديث manual_note دائماً بملاحظة المزود (ستظهر للجميع)
            update_fields.append('"manualNote" = %s')
            update_values.append(message[:500])
            print(f"💬 تحديث manualNote: {message[:50]}...")
            
            update_fields.append('"providerMessage" = %s')
            update_values.append(message[:250])
            print(f"💬 تحديث providerMessage: {message[:50]}...")
        
        # Always update lastSyncAt
        update_fields.append('"lastSyncAt" = %s')
        update_values.append(timezone.now())
        
        if update_fields:
            update_values.append(order.id)
            sql = f"""
                UPDATE product_orders
                SET {', '.join(update_fields)}
                WHERE id = %s
            """
            print(f"\n💾 Database Update:")
            print(f"   - SQL Query: {sql}")
            print(f"   - Parameters: {update_values}")
            
            with connection.cursor() as cursor:
                cursor.execute(sql, update_values)
                rows_affected = cursor.rowcount
                print(f"\n💾 تم تحديث قاعدة البيانات بنجاح ({rows_affected} صف)")
                logger.info(f"✅ Order {order.id} updated successfully ({rows_affected} rows)")
        else:
            print(f"\n⏸️  لا توجد تحديثات مطلوبة")
        
        # 9. Determine if we should retry
        # Use canonical_external_status which includes normalization of cancelled/canceled -> failed
        normalized_status = canonical_external_status.lower() if canonical_external_status else ''
        if normalized_status not in final_statuses and (new_status or '').lower() not in final_statuses:
            print(f"\n⏳ الطلب لا يزال قيد المعالجة")
            print(f"   الحالة الحالية: {new_status or 'غير محددة'} → {canonical_external_status}")
            print(f"   سيتم إعادة الفحص بعد 10 ثواني...")
            print(f"{'='*100}\n")
            
            logger.info(f"⏳ Order {order_id} still pending (status: {new_status} -> {canonical_external_status}), will retry in 10 seconds...")
            # Fixed 10 seconds retry interval
            countdown = 10
            raise self.retry(countdown=countdown, kwargs={'attempt': attempt + 1})
        
        print(f"\n✅ اكتمل فحص الطلب - الحالة النهائية: {new_status or canonical_external_status}")
        print(f"{'='*100}\n")
        
        return {
            'order_id': order_id,
            'status': new_status,
            'pin_code': pin_code,
            'message': 'Status updated successfully'
        }
        
    except Exception as exc:
        print(f"\n❌ خطأ في فحص الطلب: {str(exc)}")
        print(f"{'='*100}\n")
        logger.exception(f"❌ Error checking order {order_id}: {exc}")
        # Celery will automatically retry due to autoretry_for
        raise


@shared_task
def check_pending_orders_batch():
    """
    Check a batch of pending orders (executed periodically every 5 minutes).
    
    This task finds all orders that are in 'pending' or 'sent' status and have been
    sent more than 1 minute ago but less than 24 hours ago, then schedules individual
    check tasks for each order.
    
    Returns:
        dict: Summary of checked orders
    """
    print(f"\n{'#'*100}")
    print(f"🔍 بدء فحص دفعة الطلبات المعلقة...")
    print(f"   الوقت: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*100}")
    
    logger.info("🔍 Starting batch check for pending orders...")
    
    # Find pending orders that were sent more than 1 minute ago
    one_minute_ago = timezone.now() - timedelta(minutes=1)
    twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
    
    pending_orders = ProductOrder.objects.using('default').filter(
        external_status__in=['pending', 'sent', 'processing'],
        sent_at__isnull=False,
        sent_at__lte=one_minute_ago,
        sent_at__gte=twenty_four_hours_ago
    )[:100]  # Limit to 100 orders per batch
    
    count = len(pending_orders)
    
    print(f"\n📊 تم العثور على {count} طلب معلق للفحص")
    if count > 0:
        print(f"   سيتم جدولة فحص كل طلب بفاصل 0.05 ثانية")
        print(f"\nالطلبات المعلقة:")
        for i, order in enumerate(pending_orders, 1):
            time_waiting = timezone.now() - order.sent_at if order.sent_at else None
            waiting_str = f"{int(time_waiting.total_seconds() / 60)} دقيقة" if time_waiting else "غير معروف"
            print(f"   {i}. {str(order.id)[:8]}... | {order.external_status or 'N/A'} | انتظار: {waiting_str}")
    else:
        print(f"   ✅ لا توجد طلبات معلقة للفحص")
    
    logger.info(f"📊 Found {count} pending orders to check")
    
    # Schedule a check task for each order (distributed over 5 seconds)
    for i, order in enumerate(pending_orders):
        check_order_status.apply_async(
            args=[str(order.id), str(order.tenant_id)],
            countdown=i * 0.05  # Distribute: 0s, 0.05s, 0.1s, ...
        )
    
    print(f"\n✅ تم جدولة فحص {count} طلب")
    print(f"{'#'*100}\n")
    
    return {
        'checked': count,
        'message': f'Scheduled {count} order checks'
    }
