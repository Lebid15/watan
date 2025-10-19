import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from django.db.models import Q

print("=" * 80)
print("🔍 Checking Order 94011E in Alsham")
print("=" * 80)

# Find order by ID prefix
order = ProductOrder.objects.filter(
    id__startswith='94011e'
).first()

if order:
    print(f"\n✅ Found order:")
    print(f"  Order ID: {order.id}")
    print(f"  Tenant: {order.tenant_id}")
    print(f"  Package: {order.package.name if order.package else 'N/A'}")
    print(f"  Status: {order.status}")
    print(f"  Mode: {order.mode}")
    print(f"  External Status: {order.external_status}")
    print(f"  Provider ID: {order.provider_id or 'NOT SET ❌'}")
    print(f"  External Order ID: {order.external_order_id or 'NOT SET ❌'}")
    print(f"  Created: {order.created_at}")
    
    print(f"\n💡 Analysis:")
    if order.provider_id and order.external_order_id:
        print(f"  ✅ Order HAS been dispatched!")
        print(f"  ✅ Provider ID: {order.provider_id}")
        print(f"  ✅ External Order ID: {order.external_order_id}")
        print(f"  ✅ Celery SHOULD be checking this order!")
        
        # Check if it matches the query
        print(f"\n🔍 Checking if order matches Celery query:")
        
        # This is the exact query from check_pending_orders_batch
        matching = ProductOrder.objects.filter(
            Q(status='pending') | Q(status='processing'),
            Q(provider_id__isnull=False) & ~Q(provider_id=''),
            Q(external_order_id__isnull=False) & ~Q(external_order_id='')
        ).exclude(
            external_status__in=['completed', 'rejected', 'cancelled', 'failed']
        ).filter(id=order.id).exists()
        
        if matching:
            print(f"  ✅ Order MATCHES Celery query!")
            print(f"  ✅ Celery should be checking it every 30 seconds!")
        else:
            print(f"  ❌ Order DOES NOT match Celery query!")
            print(f"\n  Checking why:")
            print(f"    Status: {order.status} (needs 'pending' or 'processing')")
            print(f"    External Status: {order.external_status}")
            
            # Check each condition
            if order.status.lower() not in ['pending', 'processing']:
                print(f"    ❌ Status is '{order.status}' (not pending/processing)")
            else:
                print(f"    ✅ Status OK")
            
            if order.external_status in ['completed', 'rejected', 'cancelled', 'failed']:
                print(f"    ❌ External status is '{order.external_status}' (excluded)")
            else:
                print(f"    ✅ External status OK")
    else:
        print(f"  ❌ Order has NOT been dispatched yet!")
        print(f"  ❌ Provider ID: {order.provider_id or 'NULL'}")
        print(f"  ❌ External Order ID: {order.external_order_id or 'NULL'}")
        print(f"  ❌ Celery won't check it until it's dispatched!")
else:
    print(f"\n❌ Order 94011E NOT found!")

# Check all pending orders that Celery should be checking
print(f"\n" + "=" * 80)
print("📊 All Orders Celery Should Be Checking:")
print("=" * 80)

pending_orders = ProductOrder.objects.filter(
    Q(status='pending') | Q(status='processing'),
    Q(provider_id__isnull=False) & ~Q(provider_id=''),
    Q(external_order_id__isnull=False) & ~Q(external_order_id='')
).exclude(
    external_status__in=['completed', 'rejected', 'cancelled', 'failed']
).order_by('-created_at')[:10]

print(f"\nFound {pending_orders.count()} orders matching Celery query:")
if pending_orders.exists():
    for o in pending_orders:
        print(f"\n  Order: {str(o.id)[:6]}")
        print(f"    Tenant: {str(o.tenant_id)[:8]}")
        print(f"    Package: {o.package.name if o.package else 'N/A'}")
        print(f"    Status: {o.status}")
        print(f"    Provider ID: {o.provider_id}")
        print(f"    External Order ID: {str(o.external_order_id)[:8] if o.external_order_id else 'NULL'}")
else:
    print("\n  ⚠️ No orders found!")
    print("  This is why Celery logs show: 'Found 0 pending orders to check'")

print("\n" + "=" * 80)
