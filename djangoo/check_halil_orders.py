import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Checking Orders in Halil and Alsham")
print("=" * 80)

# Halil tenant
halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'
# Alsham tenant
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

print("\n📦 Orders in HALIL (ed69e1f7):")
print("-" * 80)
halil_orders = ProductOrder.objects.filter(
    tenant_id=halil_tenant_id
).order_by('-created_at')[:5]

for order in halil_orders:
    print(f"\n  Order: {order.id[:6]}")
    print(f"    Package: {order.package.name if order.package else 'N/A'}")
    print(f"    Status: {order.status}")
    print(f"    Provider Order ID: {order.provider_order_id or 'NOT SET'}")
    print(f"    Provider ID: {order.provider_id or 'NOT SET'}")
    print(f"    Created: {order.created_at}")
    
    # Check if forwarded
    if order.forwarded_to_order_id:
        print(f"    ✅ Forwarded to: {order.forwarded_to_order_id[:6]}")
    else:
        print(f"    ❌ NOT forwarded yet!")

print("\n" + "=" * 80)
print("📦 Orders in ALSHAM (7d37f00a):")
print("-" * 80)
alsham_orders = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id,
    status__in=['pending', 'processing', 'forwarded']
).order_by('-created_at')[:10]

if alsham_orders.exists():
    for order in alsham_orders:
        print(f"\n  Order: {order.id[:6]}")
        print(f"    Package: {order.package.name if order.package else 'N/A'}")
        print(f"    Status: {order.status}")
        print(f"    Provider Order ID: {order.provider_order_id or 'NOT SET'}")
        print(f"    Created: {order.created_at}")
        
        # Check if forwarded from halil
        forwarded_from = ProductOrder.objects.filter(
            forwarded_to_order_id=order.id
        ).first()
        
        if forwarded_from:
            print(f"    📥 Forwarded from: {forwarded_from.tenant_id[:8]} (Order: {forwarded_from.id[:6]})")
else:
    print("\n  ⚠️ No pending/processing orders found in alsham!")

print("\n" + "=" * 80)
print("\n💡 Summary:")
print("   - check_pending_orders_batch يبحث في alsham عن طلبات pending/processing")
print("   - إذا كان الطلب في halil فقط ولم يُرسل، لن يجده!")
print("   - يجب dispatch الطلب من halil إلى alsham أولاً")
print("\n" + "=" * 80)
