import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from django.db.models import Q

print("=" * 80)
print("🔍 Finding Recent Orders (last 10 minutes)")
print("=" * 80)

from datetime import datetime, timedelta

# Orders from last 10 minutes
recent_time = datetime.now() - timedelta(minutes=10)

recent_orders = ProductOrder.objects.filter(
    created_at__gte=recent_time
).order_by('-created_at')[:10]

print(f"\n📦 Recent orders (last 10 minutes): {recent_orders.count()}")

if recent_orders.exists():
    for order in recent_orders:
        print(f"\n  Order: {str(order.id)[:8]}")
        print(f"    Tenant: {str(order.tenant_id)[:8]}")
        print(f"    Package: {order.package.name if order.package else 'N/A'}")
        print(f"    Status: {order.status}")
        print(f"    Mode: {order.mode}")
        print(f"    Provider ID: {order.provider_id or 'NULL'}")
        print(f"    External Order ID: {str(order.external_order_id)[:8] if order.external_order_id else 'NULL'}")
        print(f"    External Status: {order.external_status}")
        print(f"    Created: {order.created_at}")
        
        # Check if it matches Celery query
        if order.status.lower() in ['pending', 'processing'] and order.provider_id and order.external_order_id:
            if order.external_status not in ['completed', 'rejected', 'cancelled', 'failed']:
                print(f"    ✅ This order SHOULD be checked by Celery!")
            else:
                print(f"    ❌ External status is '{order.external_status}' (won't be checked)")
        else:
            print(f"    ❌ Missing provider_id or external_order_id (won't be checked)")
else:
    print("\n  ❌ No recent orders!")

# Also check alsham tenant specifically
print(f"\n" + "=" * 80)
print("📦 All Recent Orders in ALSHAM:")
print("=" * 80)

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
alsham_orders = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id
).order_by('-created_at')[:10]

for order in alsham_orders:
    print(f"\n  Order: {str(order.id)[:8]}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Provider ID: {order.provider_id or 'NULL'}")
    print(f"    Created: {order.created_at}")

# Check shamtech/diana tenant
print(f"\n" + "=" * 80)
print("📦 Recent Orders in SHAMTECH/DIANA:")
print("=" * 80)

diana_tenant_id = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'
diana_orders = ProductOrder.objects.filter(
    tenant_id=diana_tenant_id
).order_by('-created_at')[:5]

if diana_orders.exists():
    for order in diana_orders:
        print(f"\n  Order: {str(order.id)[:8]}")
        print(f"    Package: {order.package.name if order.package else 'N/A'}")
        print(f"    Status: {order.status}")
        print(f"    Provider ID: {order.provider_id or 'NULL'}")
        print(f"    Created: {order.created_at}")
else:
    print("\n  ❌ No orders in shamtech/diana!")

print("\n" + "=" * 80)
