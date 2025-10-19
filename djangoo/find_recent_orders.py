import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Searching for Recent Orders (1ED7D2 and EC989B)")
print("=" * 80)

# Search by ID prefix
orders = ProductOrder.objects.filter(
    id__startswith='1ed7d2'
).order_by('-created_at')

print(f"\n📦 Orders starting with 1ED7D2: {orders.count()}")
for order in orders:
    print(f"\n  Full ID: {order.id}")
    print(f"    Tenant: {order.tenant_id}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Provider Order ID: {order.provider_order_id or 'NOT SET'}")
    print(f"    Created: {order.created_at}")

orders = ProductOrder.objects.filter(
    id__startswith='ec989b'
).order_by('-created_at')

print(f"\n📦 Orders starting with EC989B: {orders.count()}")
for order in orders:
    print(f"\n  Full ID: {order.id}")
    print(f"    Tenant: {order.tenant_id}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Provider Order ID: {order.provider_order_id or 'NOT SET'}")
    print(f"    Created: {order.created_at}")

# Show all recent orders
print("\n" + "=" * 80)
print("📦 All Recent Orders (last 10):")
print("=" * 80)

all_orders = ProductOrder.objects.all().order_by('-created_at')[:10]
for order in all_orders:
    print(f"\n  Order: {str(order.id)[:6]}")
    print(f"    Tenant: {str(order.tenant_id)[:8]}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Created: {order.created_at}")

print("\n" + "=" * 80)
