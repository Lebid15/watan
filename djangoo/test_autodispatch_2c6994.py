import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# Find order 2C6994
order_id = '2c6994d7-bdf1-4a41-8b02-4dc3727cf638'

order = ProductOrder.objects.get(id=order_id)
print(f"Order: {order.id}")
print(f"Status: {order.status}")
print(f"Package: {order.package_id}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")

# Check routing config
from apps.providers.models import PackageRouting

routing = PackageRouting.objects.filter(
    tenant_id=order.tenant_id,
    package_id=order.package_id
).first()

if routing:
    print(f"\n✅ PackageRouting found:")
    print(f"   Mode: {routing.mode}")
    print(f"   Integration ID: {routing.integration_id}")
    print(f"   Provider Type: {routing.provider_type}")
else:
    print("\n❌ No PackageRouting found")

# Now try auto-dispatch
print("\n" + "="*50)
print("CALLING try_auto_dispatch()...")
print("="*50)

try:
    result = try_auto_dispatch(str(order.id))
    print(f"\n✅ Auto-dispatch result: {result}")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
