from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# Get the order
order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')

print(f"{'='*60}")
print(f"🚀 DISPATCHING ORDER TO DIANA")
print(f"{'='*60}")
print(f"Order ID: {order.id}")
print(f"Order No: {str(order.id)[-6:].upper()}")
print(f"Tenant ID: {order.tenant_id}")
print(f"Provider ID: {order.provider_id}")
print(f"Status: {order.status}")
print(f"External Status: {order.external_status}")

print(f"\n⏳ Calling try_auto_dispatch...")

try:
    result = try_auto_dispatch(str(order.id), str(order.tenant_id))
    print(f"\n✅ Dispatch completed!")
    print(f"Result: {result}")
except Exception as e:
    print(f"\n❌ Dispatch failed!")
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

# Refresh order from DB
order.refresh_from_db()
print(f"\n{'='*60}")
print(f"📊 ORDER STATUS AFTER DISPATCH")
print(f"{'='*60}")
print(f"Status: {order.status}")
print(f"External Status: {order.external_status}")
print(f"External Order ID: {order.external_order_id}")
print(f"{'='*60}")
