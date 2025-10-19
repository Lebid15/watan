import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from datetime import timedelta
from django.utils import timezone

print("=" * 80)
print("🔍 Why Celery is NOT Checking Order cb8257e0")
print("=" * 80)

order = ProductOrder.objects.filter(id__startswith='cb8257').first()

if order:
    print(f"\n✅ Found order: {order.id}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Sent At: {order.sent_at or 'NULL ❌'}")
    print(f"  Created: {order.created_at}")
    
    print(f"\n🔍 Checking Against Celery Query:")
    print(f"\nThe task check_pending_orders_batch looks for orders WHERE:")
    print(f"  1. external_status IN ('pending', 'sent', 'processing')")
    print(f"  2. sent_at IS NOT NULL")
    print(f"  3. sent_at <= 1 minute ago")
    print(f"  4. sent_at >= 24 hours ago")
    
    print(f"\nOrder cb8257e0 values:")
    print(f"  1. external_status = '{order.external_status}' ", end='')
    if order.external_status in ['pending', 'sent', 'processing']:
        print(f"✅")
    else:
        print(f"❌ (not in list!)")
    
    print(f"  2. sent_at = {order.sent_at or 'NULL'} ", end='')
    if order.sent_at:
        print(f"✅")
    else:
        print(f"❌ (NULL!)")
    
    if order.sent_at:
        one_minute_ago = timezone.now() - timedelta(minutes=1)
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        print(f"  3. sent_at <= 1 minute ago: {order.sent_at <= one_minute_ago} ", end='')
        print(f"✅" if order.sent_at <= one_minute_ago else "❌")
        
        print(f"  4. sent_at >= 24 hours ago: {order.sent_at >= twenty_four_hours_ago} ", end='')
        print(f"✅" if order.sent_at >= twenty_four_hours_ago else "❌")
    
    print(f"\n💡 Conclusion:")
    if not order.sent_at:
        print(f"  ❌ sent_at is NULL!")
        print(f"  ❌ This means the order was NOT dispatched properly!")
        print(f"  ❌ Even though provider_id and external_order_id are set,")
        print(f"     the sent_at timestamp was not set during dispatch!")
    elif order.external_status not in ['pending', 'sent', 'processing']:
        print(f"  ❌ external_status is '{order.external_status}'")
        print(f"  ❌ Not in the list: 'pending', 'sent', 'processing'")
    else:
        print(f"  ✅ All conditions met! Celery should check this order!")

# Test the actual query
print(f"\n" + "=" * 80)
print("🔍 Testing Actual Query:")
print("=" * 80)

one_minute_ago = timezone.now() - timedelta(minutes=1)
twenty_four_hours_ago = timezone.now() - timedelta(hours=24)

pending_orders = ProductOrder.objects.filter(
    external_status__in=['pending', 'sent', 'processing'],
    sent_at__isnull=False,
    sent_at__lte=one_minute_ago,
    sent_at__gte=twenty_four_hours_ago
)[:100]

print(f"\nFound {pending_orders.count()} orders matching query:")
for o in pending_orders:
    print(f"\n  Order: {str(o.id)[:8]}")
    print(f"    External Status: {o.external_status}")
    print(f"    Sent At: {o.sent_at}")
    print(f"    Provider ID: {o.provider_id or 'NULL'}")

print("\n" + "=" * 80)
