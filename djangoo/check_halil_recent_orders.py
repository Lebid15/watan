import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Recent Orders in Halil")
print("=" * 80)

# Halil tenant
halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'

orders = ProductOrder.objects.filter(
    tenant_id=halil_tenant_id
).order_by('-created_at')[:10]

print(f"\n📦 Last 10 orders in HALIL:")
if orders.exists():
    for order in orders:
        print(f"\n  Order No: {order.order_no}")
        print(f"    Order ID: {str(order.id)[:8]}")
        print(f"    Package: {order.package.name if order.package else 'N/A'}")
        print(f"    Status: {order.status}")
        print(f"    Mode: {order.mode}")
        print(f"    Created: {order.created_at}")
else:
    print("\n  ❌ No orders found in halil!")
    print("\n  💡 Possible reasons:")
    print("     1. Order was created in a different tenant")
    print("     2. Order creation failed")
    print("     3. Wrong tenant ID")

# Check alsham too
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
print(f"\n" + "=" * 80)
print("📦 Recent orders in ALSHAM (for comparison):")
print("=" * 80)

alsham_orders = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id
).order_by('-created_at')[:5]

for order in alsham_orders:
    print(f"\n  Order No: {order.order_no}")
    print(f"    Order ID: {str(order.id)[:8]}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Created: {order.created_at}")

print("\n" + "=" * 80)
