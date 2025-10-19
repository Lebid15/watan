import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting

print("=" * 80)
print("🔍 Checking Order Routing Mode")
print("=" * 80)

order = ProductOrder.objects.filter(id__startswith='7a5e48da').first()

if order:
    print(f"\n✅ Order: {order.id}")
    print(f"  Package: {order.package.name if order.package else 'N/A'}")
    print(f"  Provider ID: {order.provider_id or 'NULL'}")
    print(f"  External Order ID: {order.external_order_id or 'NULL'}")
    
    if order.package:
        # Find routing
        routing = PackageRouting.objects.filter(
            tenant_id=order.tenant_id,
            package_id=order.package_id
        ).first()
        
        if routing:
            print(f"\n📍 Package Routing:")
            print(f"  Mode: {routing.mode}")
            print(f"  Provider Type: {routing.provider_type}")
            print(f"  Primary Provider: {routing.primary_provider_id or 'NULL'}")
            
            if routing.mode == 'manual':
                print(f"\n❗ This is why Celery skips it!")
                print(f"  Manual orders are not automatically tracked.")
                print(f"  You need to manually check their status in the provider system.")
            elif routing.mode == 'auto':
                print(f"\n✅ Auto mode - Celery should track this order")
        else:
            print(f"\n⚠️ No routing found for this package!")
            print(f"  Package ID: {order.package_id}")
            print(f"  Tenant ID: {order.tenant_id}")
    else:
        print(f"\n⚠️ Order has no package!")
else:
    print(f"\n❌ Order not found!")

print("\n" + "=" * 80)
