import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from datetime import timedelta
from django.utils import timezone

print("=" * 80)
print("🔍 Checking Orders D509B7 (alsham) and 059EDF (diana)")
print("=" * 80)

# Find alsham order
alsham_order = ProductOrder.objects.filter(id__startswith='d509b7').first()

if alsham_order:
    print(f"\n✅ ALSHAM Order D509B7:")
    print(f"  Order ID: {alsham_order.id}")
    print(f"  Package: {alsham_order.package.name if alsham_order.package else 'N/A'}")
    print(f"  Status: {alsham_order.status}")
    print(f"  External Status: {alsham_order.external_status}")
    print(f"  Provider ID: {alsham_order.provider_id or 'NULL'}")
    print(f"  External Order ID: {alsham_order.external_order_id or 'NULL'}")
    print(f"  Sent At: {alsham_order.sent_at or 'NULL'}")
    print(f"  Created: {alsham_order.created_at}")
    
    print(f"\n🔍 Checking if it matches Celery query:")
    print(f"  1. external_status in ['pending', 'sent', 'processing']: ", end='')
    if alsham_order.external_status in ['pending', 'sent', 'processing']:
        print(f"✅ ({alsham_order.external_status})")
    else:
        print(f"❌ ({alsham_order.external_status})")
    
    print(f"  2. sent_at is not NULL: ", end='')
    if alsham_order.sent_at:
        print(f"✅")
        
        one_minute_ago = timezone.now() - timedelta(minutes=1)
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        print(f"  3. sent_at <= 1 minute ago: ", end='')
        if alsham_order.sent_at <= one_minute_ago:
            print(f"✅")
        else:
            time_diff = (timezone.now() - alsham_order.sent_at).total_seconds()
            print(f"❌ (sent {int(time_diff)} seconds ago, need 60+ seconds)")
        
        print(f"  4. sent_at >= 24 hours ago: ", end='')
        if alsham_order.sent_at >= twenty_four_hours_ago:
            print(f"✅")
        else:
            print(f"❌")
    else:
        print(f"❌")
else:
    print(f"\n❌ Order D509B7 NOT found in alsham!")

# Find diana order
print(f"\n" + "=" * 80)
diana_order = ProductOrder.objects.filter(id__startswith='059edf').first()

if diana_order:
    print(f"\n✅ DIANA Order 059EDF:")
    print(f"  Order ID: {diana_order.id}")
    print(f"  Package: {diana_order.package.name if diana_order.package else 'N/A'}")
    print(f"  Status: {diana_order.status}")
    print(f"  External Status: {diana_order.external_status}")
    print(f"  Provider ID: {diana_order.provider_id or 'NULL'}")
    print(f"  Sent At: {diana_order.sent_at or 'NULL'}")
    print(f"  Created: {diana_order.created_at}")
    
    print(f"\n💡 This is the order in shamtech/diana")
    if not diana_order.provider_id:
        print(f"  ⚠️ Not dispatched to external provider yet (manual mode)")
else:
    print(f"\n❌ Order 059EDF NOT found in diana!")

# Check all orders matching Celery query
print(f"\n" + "=" * 80)
print("📊 All Orders Celery Should Be Checking:")
print("=" * 80)

one_minute_ago = timezone.now() - timedelta(minutes=1)
twenty_four_hours_ago = timezone.now() - timedelta(hours=24)

pending_orders = ProductOrder.objects.filter(
    external_status__in=['pending', 'sent', 'processing'],
    sent_at__isnull=False,
    sent_at__lte=one_minute_ago,
    sent_at__gte=twenty_four_hours_ago
)[:10]

print(f"\nFound {pending_orders.count()} orders:")
for o in pending_orders:
    print(f"\n  Order: {str(o.id)[:8]}")
    print(f"    Tenant: {str(o.tenant_id)[:8]}")
    print(f"    Package: {o.package.name if o.package else 'N/A'}")
    print(f"    External Status: {o.external_status}")
    print(f"    Sent At: {o.sent_at}")
    time_waiting = (timezone.now() - o.sent_at).total_seconds() / 60
    print(f"    Waiting: {int(time_waiting)} minutes")

if pending_orders.count() == 0:
    print("\n  ⚠️ No orders found!")
    print("  Possible reasons:")
    print("    1. Orders were sent less than 1 minute ago")
    print("    2. external_status is not 'pending', 'sent', or 'processing'")
    print("    3. sent_at is NULL")

print("\n" + "=" * 80)
