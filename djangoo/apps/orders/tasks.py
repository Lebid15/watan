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
from apps.providers.models import PackageRouting, Integration
from apps.providers.adapters import resolve_adapter_credentials
from .services import (
    apply_order_status_change,
    OrderStatusError,
    TenantMismatchError,
    LegacyUserMissingError,
    OverdraftExceededError,
    _propagate_chain_status,
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


_MANUAL_PROVIDER_TOKENS = {
    '',
    'manual',
    'manual_provider',
    'manual-execution',
    'manual_execution',
    'manual-order',
    'manualorder',
    'manual_external',
    'not_sent',
    'pending',
    '__codes__',
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
    # Disable ALL verbose logging - only keep essential INFO logs
    verbose = False  # Set to True for debugging
    
    logger.info(f"[CHECK] [Attempt {attempt}] Checking status for order: {order_id}")
    
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
        
        # 1.5. Skip orders that haven't been sent yet (no external_order_id)
        # We only track orders that have been dispatched to an external provider
        # This handles scenarios 1, 2, and 6 from the requirements
        if not order.external_order_id:
            if verbose:
                print(f"[SKIP] Order not sent yet (no external_order_id) - skipping")
            if verbose:
                print(f"   [INFO] This order has not been dispatched to external provider yet")
            if verbose:
                print(f"   [INFO] Tenant will review manually or dispatch later")
            logger.info(f"⏭️  Order {order_id} not sent yet - skipping status check")
            return {
                'order_id': order_id,
                'status': 'not_sent',
                'message': 'Order not sent to external provider yet'
            }
        
        # 2. Check if order is already in final state (case-insensitive)
        final_statuses = ['completed', 'delivered', 'cancelled', 'canceled', 'failed', 'rejected', 'done']
        if order.external_status and order.external_status.lower() in final_statuses:
            if verbose:
                print(f"[SUCCESS] Order in final status: {order.external_status}")
            if verbose:
                print(f"   Internal status: {order.status}")
            if verbose:
                print(f"{'='*100}\n")
            logger.info(f"[SUCCESS] Order {order_id} already in final state: {order.external_status}")
            return {
                'order_id': order_id,
                'status': order.external_status,
                'message': 'Already in final state'
            }
        
        # 3. Check if order has exceeded 24-hour timeout (Scenario 7)
        if order.sent_at:
            time_since_sent = timezone.now() - order.sent_at
            if time_since_sent > timedelta(hours=24):
                if verbose:
                    print(f"⏰ الطلب تجاوز 24 ساعة - سيتم وضع علامة فشل")
                if verbose:
                    print(f"   ⏱️  الوقت المنقضي: {int(time_since_sent.total_seconds() / 3600)} ساعة")
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
                
                # Trigger chain propagation for timeout
                try:
                    order.refresh_from_db()
                    _propagate_chain_status(order, origin="timeout", manual_note="Order timed out after 24 hours")
                    if verbose:
                        print(f"   🔗 تم تفعيل سلسلة التحديث للطلب المنتهي الصلاحية")
                except Exception as e:
                    logger.exception(f"Failed to propagate chain status for timed out order {order_id}: {e}")
                
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
        order_provider_id = (order.provider_id or '').strip()

        if verbose:
            print("   Provider ID on order:", order_provider_id or 'none')
        if verbose:
            print("   External order id:", order.external_order_id or 'none')
        referans_debug = getattr(order, 'provider_referans', None) or 'none'
        if verbose:
            print("   Provider referans:", referans_debug)

        provider_id = order_provider_id
        integration = None
        integration_source = None
        routing = None

        if provider_id and provider_id.lower() not in _MANUAL_PROVIDER_TOKENS:
            try:
                integration = Integration.objects.get(id=provider_id, tenant_id=tenant_id)
                integration_source = 'order_provider'
            except (Integration.DoesNotExist, ValueError) as exc:
                if verbose:
                    print(f"   Warning: integration lookup failed for provider_id={provider_id}: {exc}")
                logger.warning(
                    "Provider from order not resolved, falling back to routing",
                    extra={
                        "order_id": order_id,
                        "provider_id": provider_id,
                        "error": str(exc),
                    },
                )
                integration = None

        if integration is None:
            if verbose:
                print("   Falling back to package routing for provider resolution")
            # ✅ FIX: Prefer external routing when multiple exist
            routing = PackageRouting.objects.using('default').filter(
                package_id=package.id,
                tenant_id=tenant_id,
                provider_type='external'
            ).first()
            
            # If no external routing, try any routing
            if not routing:
                routing = PackageRouting.objects.using('default').filter(
                    package_id=package.id,
                    tenant_id=tenant_id
                ).first()

            if not routing or not routing.primary_provider_id:
                logger.error(f"❌ No routing found for order {order_id}")
                return {'order_id': order_id, 'status': 'error', 'message': 'No routing'}

            provider_id = str(routing.primary_provider_id)
            if verbose:
                print("   Routing primary_provider_id:", provider_id)
            try:
                integration = Integration.objects.get(id=routing.primary_provider_id, tenant_id=tenant_id)
                integration_source = 'package_routing'
            except (Integration.DoesNotExist, ValueError) as exc:
                logger.error(
                    "❌ Routing provider integration missing",
                    extra={
                        "order_id": order_id,
                        "routing_provider_id": routing.primary_provider_id,
                        "error": str(exc),
                    },
                )
                return {'order_id': order_id, 'status': 'error', 'message': 'Integration missing'}

        if verbose:
            print(f"   Provider chosen for monitoring: {integration.name} ({integration.provider}) [{integration_source}]")
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
        
        if verbose:
            print(f"\n📡 استعلام عن حالة الطلب من المزود: {integration.provider}")
        if verbose:
            print(f"   المرجع: {referans}")
        if verbose:
            print(f"   الحالة الحالية: {order.external_status or 'غير محددة'}")
        
        logger.info(f"📡 Fetching status from {integration.provider} for referans: {referans}")
        
        # 7. Call adapter to fetch status
        result = binding.adapter.fetch_status(creds, referans)
        
        if verbose:
            print(f"\n📥 استجابة المزود:")
        if verbose:
            print(f"   الحالة: {result.get('status', 'N/A')}")
        if result.get('pinCode'):
            if verbose:
                print(f"   PIN Code: {result.get('pinCode')[:10]}...")
        if result.get('message'):
            if verbose:
                print(f"   الرسالة: {result.get('message')}")
        
        logger.info(f"📥 Provider response: {result}")
        
        # 8. Update order status
        old_status = order.external_status
        old_order_status = order.status
        new_status = result.get('status')
        pin_code = result.get('pinCode')
        message = result.get('message') or result.get('note')
        
        if verbose:
            print(f"\n📊 Current State:")
        if verbose:
            print(f"   - Current external_status: {old_status}")
        if verbose:
            print(f"   - Current order status: {old_order_status}")
        if verbose:
            print(f"   - New status from provider: {new_status}")
        if verbose:
            print(f"   - PIN Code from provider: {pin_code}")
        if verbose:
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
        
        if verbose:
            print(f"\n🗺️ Status Mapping:")
        if verbose:
            print(f"   - Available mappings: {order_status_map}")
        
        # Build update query
        from django.db import connection
        update_fields = []
        update_values = []
        
        canonical_external_status = _normalize_external_status(new_status, old_status or 'processing')
        new_order_status = order_status_map.get((new_status or '').lower(), old_order_status)

        if verbose:
            print(f"\n🔄 معالجة الحالة:")
        if verbose:
            print(f"   📌 الحالة من المزود: {new_status or 'N/A'}")
        if verbose:
            print(f"   📌 الحالة المطبّعة: {canonical_external_status}")
        if verbose:
            print(f"   📌 الحالة الداخلية الجديدة: {new_order_status}")
        if verbose:
            print(f"   📊 الحالة الحالية: {old_order_status}")
        
        if new_status and new_status != old_status:
            if verbose:
                print(f"   ✨ تغيير في الحالة: {old_status} → {new_status}")
        else:
            if verbose:
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
                
                if verbose:
                    print(f"\n⚙️ تطبيق انتقال الحالة{cancellation_reason_ar}:")
                if verbose:
                    print(f"   من: {old_order_status} → إلى: {new_order_status}")
                if verbose:
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
                
                if verbose:
                    print(f"   [SUCCESS] Status and balance updated successfully")
                if verbose:
                    print(f"   الحالة النهائية: {order.status}")
                
                logger.info(
                    "[SUCCESS] apply_order_status_change succeeded",
                    extra={
                        "order_id": str(order.id),
                        "status": order.status,
                        "external_status": order.external_status,
                    },
                )
            except (OrderStatusError, TenantMismatchError, LegacyUserMissingError, OverdraftExceededError) as status_exc:
                if verbose:
                    print(f"   ⚠️ تعذر تطبيق الانتقال الكامل: {str(status_exc)}")
                if verbose:
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
            if verbose:
                print(f"\n🔄 تحديث الحالة الخارجية فقط: {old_status} → {canonical_external_status}")
            logger.info(f"🔄 External Status changed: {old_status} → {canonical_external_status}")

        # Ensure we persist the canonical external status when terminal transition already handled by apply()
        if status_transition_needed:
            update_fields.append('"externalStatus" = %s')
            update_values.append(canonical_external_status)
        else:
            if verbose:
                print(f"\n⚠️ External status NOT changing:")
            if not new_status:
                if verbose:
                    print(f"   - Reason: No status in provider response")
            elif new_status == old_status:
                if verbose:
                    print(f"   - Reason: Same as current ({old_status})")
        
        if pin_code and pin_code != order.pin_code:
            update_fields.append('"pinCode" = %s')
            update_values.append(pin_code)
            if verbose:
                print(f"🔑 استلام PIN Code: {pin_code[:10]}...")
            logger.info(f"🔑 PIN Code received: {pin_code[:10]}...")
        
        if message:
            new_message = (order.last_message or '') + f" | {message}"
            update_fields.append('"lastMessage" = %s')
            update_values.append(new_message[:250])
            
            # ✅ تحديث manual_note دائماً بملاحظة المزود (ستظهر للجميع)
            update_fields.append('"manualNote" = %s')
            update_values.append(message[:500])
            if verbose:
                print(f"💬 تحديث manualNote: {message[:50]}...")
            
            update_fields.append('"providerMessage" = %s')
            update_values.append(message[:250])
            if verbose:
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
            if verbose:
                print(f"\n💾 Database Update:")
            if verbose:
                print(f"   - SQL Query: {sql}")
            if verbose:
                print(f"   - Parameters: {update_values}")
            
            with connection.cursor() as cursor:
                cursor.execute(sql, update_values)
                rows_affected = cursor.rowcount
                if verbose:
                    print(f"\n💾 تم تحديث قاعدة البيانات بنجاح ({rows_affected} صف)")
                logger.info(f"✅ Order {order.id} updated successfully ({rows_affected} rows)")

            if any('status = %s' in field or '"externalStatus"' in field for field in update_fields):
                try:
                    order.refresh_from_db()
                except ProductOrder.DoesNotExist:
                    logger.warning(
                        "Order disappeared before chain propagation",
                        extra={"order_id": order_id},
                    )
                except Exception:
                    logger.exception(
                        "Failed to refresh order before chain propagation",
                        extra={"order_id": order_id},
                    )
                else:
                    try:
                        if verbose:
                            print(f"   🔗 تفعيل سلسلة التحديث للطلب...")
                        _propagate_chain_status(order, origin="status_poll", manual_note=message)
                        if verbose:
                            print(f"   [SUCCESS] Chain update activated successfully")
                        logger.info(f"[SUCCESS] Chain status propagation completed for order {order_id}")
                    except Exception:
                        logger.exception(
                            "Chain status propagation failed after status poll",
                            extra={"order_id": order_id},
                        )
                        if verbose:
                            print(f"   ⚠️ فشل في تفعيل سلسلة التحديث")
        else:
            if verbose:
                print(f"\n⏸️  لا توجد تحديثات مطلوبة")
        
        # 9. Determine if we should retry
        # Use canonical_external_status which includes normalization of cancelled/canceled -> failed
        normalized_status = canonical_external_status.lower() if canonical_external_status else ''
        if normalized_status not in final_statuses and (new_status or '').lower() not in final_statuses:
            if verbose:
                print(f"\n⏳ الطلب لا يزال قيد المعالجة")
            if verbose:
                print(f"   الحالة الحالية: {new_status or 'غير محددة'} → {canonical_external_status}")
            
            # في وضع CELERY_TASK_ALWAYS_EAGER، لا نعمل retry لأنه غير مدعوم
            from django.conf import settings
            if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                if verbose:
                    print(f"   ⚠️ EAGER mode: skipping retry")
                if verbose:
                    print(f"{'='*100}\n")
                return {
                    'order_id': order_id,
                    'status': new_status,
                    'message': 'Status check skipped (EAGER mode)'
                }
            
            if verbose:
                print(f"   سيتم إعادة الفحص بعد 10 ثواني...")
            if verbose:
                print(f"{'='*100}\n")
            
            logger.info(f"⏳ Order {order_id} still pending (status: {new_status} -> {canonical_external_status}), will retry in 10 seconds...")
            # Fixed 10 seconds retry interval
            countdown = 10
            raise self.retry(countdown=countdown, kwargs={'attempt': attempt + 1})
        
        if verbose:
            print(f"\n[SUCCESS] Order check completed - Final status: {new_status or canonical_external_status}")
        if verbose:
            print(f"{'='*100}\n")
        
        return {
            'order_id': order_id,
            'status': new_status,
            'pin_code': pin_code,
            'message': 'Status updated successfully'
        }
        
    except Exception as exc:
        if verbose:
            print(f"\n❌ خطأ في فحص الطلب: {str(exc)}")
        if verbose:
            print(f"{'='*100}\n")
        logger.exception(f"❌ Error checking order {order_id}: {exc}")
        # Celery will automatically retry due to autoretry_for
        raise


@shared_task
def check_pending_orders_batch():
    """
    Check a batch of pending orders (executed periodically every 5 minutes).
    
    This task finds all orders that have been dispatched to external providers
    (have external_order_id) and are not in final state, then schedules individual
    check tasks for each order.
    
    Also includes lightweight notification for orders pending too long (5+ minutes).
    
    Returns:
        dict: Summary of checked orders
    """
    print(f"\n{'#'*100}")
    print(f"[BATCH] Starting batch check for pending orders...")
    print(f"   Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*100}")
    
    logger.info("[BATCH] Starting batch check for pending orders...")
    
    # Find pending orders that were sent more than 1 minute ago
    one_minute_ago = timezone.now() - timedelta(minutes=1)
    five_minutes_ago = timezone.now() - timedelta(minutes=5)
    twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
    
    # CRITICAL FIX: Track ALL orders that have been sent to external providers
    # regardless of mode (manual/auto) - what matters is they have external_order_id
    # and are not in final state
    from django.db.models import Q
    
    pending_orders = ProductOrder.objects.using('default').filter(
        # Must have been sent to external provider
        external_order_id__isnull=False,
        sent_at__isnull=False,
        sent_at__lte=one_minute_ago,
        sent_at__gte=twenty_four_hours_ago
    ).exclude(
        # Exclude final states (case-insensitive)
        Q(external_status__iexact='completed') |
        Q(external_status__iexact='delivered') |
        Q(external_status__iexact='done') |
        Q(external_status__iexact='cancelled') |
        Q(external_status__iexact='canceled') |
        Q(external_status__iexact='failed') |
        Q(external_status__iexact='rejected')
    )[:100]  # Limit to 100 orders per batch
    
    count = len(pending_orders)
    
    print(f"\n[FOUND] Found {count} pending orders to check")
    if count > 0:
        print(f"   Will schedule check for each order with 0.05s interval")
        print(f"\nPending orders:")
        for i, order in enumerate(pending_orders, 1):
            time_waiting = timezone.now() - order.sent_at if order.sent_at else None
            waiting_str = f"{int(time_waiting.total_seconds() / 60)} minutes" if time_waiting else "unknown"
            print(f"   {i}. {str(order.id)[:8]}... | {order.external_status or 'N/A'} | waiting: {waiting_str}")
    else:
        print(f"   [SUCCESS] No pending orders to check")
    
    logger.info(f"[FOUND] Found {count} pending orders to check")
    
    # Schedule a check task for each order (distributed over 5 seconds)
    for i, order in enumerate(pending_orders):
        check_order_status.apply_async(
            args=[str(order.id), str(order.tenant_id)],
            countdown=i * 0.05  # Distribute: 0s, 0.05s, 0.1s, ...
        )
    
    print(f"\n[SUCCESS] Scheduled check for {count} orders")
    
    # Lightweight notification for orders pending too long (5+ minutes)
    # This handles the optional 5-minute alert requirement
    long_pending_orders = ProductOrder.objects.using('default').filter(
        external_order_id__isnull=False,
        sent_at__isnull=False,
        sent_at__lte=five_minutes_ago,
        sent_at__gte=twenty_four_hours_ago
    ).exclude(
        Q(external_status__iexact='completed') |
        Q(external_status__iexact='delivered') |
        Q(external_status__iexact='done') |
        Q(external_status__iexact='cancelled') |
        Q(external_status__iexact='canceled') |
        Q(external_status__iexact='failed') |
        Q(external_status__iexact='rejected')
    )[:20]  # Limit to 20 for notifications
    
    notification_count = len(long_pending_orders)
    if notification_count > 0:
        print(f"\n[NOTIFICATION] Long pending orders ({notification_count} orders):")
        for i, order in enumerate(long_pending_orders, 1):
            time_waiting = timezone.now() - order.sent_at if order.sent_at else None
            waiting_str = f"{int(time_waiting.total_seconds() / 60)} minutes" if time_waiting else "unknown"
            print(f"   {i}. {str(order.id)[:8]}... | waiting: {waiting_str}")
            logger.info(f"[NOTIFICATION] Long pending order: {order.id} waiting {waiting_str}")
    
    print(f"{'#'*100}\n")
    
    return {
        'checked': count,
        'notifications': notification_count,
        'message': f'Scheduled {count} order checks'
    }
