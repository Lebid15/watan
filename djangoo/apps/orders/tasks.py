"""
Celery tasks for order status monitoring and updates.

This module contains background tasks that check order status from external providers
and update the order database accordingly.
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from .models import ProductOrder
from apps.providers.models import PackageRouting
from apps.providers.adapters import resolve_adapter_credentials

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=20,
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
        final_statuses = ['completed', 'delivered', 'cancelled', 'failed', 'rejected', 'done']
        if order.external_status in final_statuses:
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
        
        integration = routing.primary_provider
        
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
        
        logger.info(f"📡 Fetching status from {integration.provider} for referans: {referans}")
        
        # 7. Call adapter to fetch status
        result = binding.adapter.fetch_status(creds, referans)
        
        logger.info(f"📥 Provider response: {result}")
        print(f"\n{'='*80}")
        print(f"🔍 DEBUG: Processing provider response for order {order_id}")
        print(f"{'='*80}")
        print(f"📥 Full Response from provider: {result}")
        
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
            'failed': 'rejected',
            'rejected': 'rejected',
            'error': 'rejected',
            'cancelled': 'rejected',
        }
        
        print(f"\n🗺️ Status Mapping:")
        print(f"   - Available mappings: {order_status_map}")
        
        # Build update query
        from django.db import connection
        update_fields = []
        update_values = []
        
        if new_status and new_status != old_status:
            update_fields.append('"externalStatus" = %s')
            update_values.append(new_status)
            logger.info(f"🔄 External Status changed: {old_status} → {new_status}")
            print(f"\n✅ Will update external_status: {old_status} → {new_status}")
            
            # Update order status based on external status
            new_order_status = order_status_map.get(new_status.lower(), old_order_status)
            print(f"\n🔍 Checking status mapping:")
            print(f"   - Looking for: '{new_status.lower()}' in map")
            print(f"   - Found: {new_order_status}")
            print(f"   - Old order status: {old_order_status}")
            print(f"   - Will change? {new_order_status != old_order_status}")
            
            if new_order_status != old_order_status:
                update_fields.append('status = %s')
                update_values.append(new_order_status)
                logger.info(f"📋 Order Status changed: {old_order_status} → {new_order_status}")
                print(f"✅ Will update order status: {old_order_status} → {new_order_status}")
            else:
                print(f"⚠️ Order status NOT changing (already {old_order_status})")
        else:
            print(f"\n⚠️ External status NOT changing:")
            if not new_status:
                print(f"   - Reason: No status in provider response")
            elif new_status == old_status:
                print(f"   - Reason: Same as current ({old_status})")
        
        if pin_code and pin_code != order.pin_code:
            update_fields.append('"pinCode" = %s')
            update_values.append(pin_code)
            logger.info(f"🔑 PIN Code received: {pin_code[:10]}...")
            print(f"✅ Will update PIN Code")
        
        if message:
            new_message = (order.last_message or '') + f" | {message}"
            update_fields.append('"lastMessage" = %s')
            update_values.append(new_message[:250])
            print(f"✅ Will update message")
        
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
                print(f"   - Rows affected: {rows_affected}")
                logger.info(f"✅ Order {order.id} updated successfully ({rows_affected} rows)")
                
            print(f"\n{'='*80}")
            print(f"✅ DEBUG: Order {order_id} processing complete")
            print(f"{'='*80}\n")
        else:
            print(f"\n⚠️ No fields to update")
            print(f"{'='*80}")
            print(f"⚠️ DEBUG: Order {order_id} - no changes needed")
            print(f"{'='*80}\n")
        
        # 9. Determine if we should retry
        if new_status not in final_statuses:
            logger.info(f"⏳ Order {order_id} still pending, will retry in 10 seconds...")
            # Fixed 10 seconds retry interval
            countdown = 10
            raise self.retry(countdown=countdown, kwargs={'attempt': attempt + 1})
        
        return {
            'order_id': order_id,
            'status': new_status,
            'pin_code': pin_code,
            'message': 'Status updated successfully'
        }
        
    except Exception as exc:
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
    logger.info(f"📊 Found {count} pending orders to check")
    
    # Schedule a check task for each order (distributed over 5 seconds)
    for i, order in enumerate(pending_orders):
        check_order_status.apply_async(
            args=[str(order.id), str(order.tenant_id)],
            countdown=i * 0.05  # Distribute: 0s, 0.05s, 0.1s, ...
        )
    
    return {
        'checked': count,
        'message': f'Scheduled {count} order checks'
    }
