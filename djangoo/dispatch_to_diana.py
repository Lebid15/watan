from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting
from apps.orders.services import try_auto_dispatch
import uuid

# Get the order
order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')
print(f"Order: {order.id}")
print(f"Tenant: {order.tenant_id}")
print(f"Package: {order.package_id}")
print(f"Current provider: {order.provider_id}")

# Get or create diana integration
diana, created = Integration.objects.get_or_create(
    tenant_id=order.tenant_id,
    name='diana',
    defaults={
        'id': uuid.uuid4(),
        'provider': 'internal',
        'enabled': True,
        'created_at': '2025-10-22 00:00:00'
    }
)
print(f"\nDiana provider: {diana.id} - {diana.name} (created={created})")

# Get or create package routing
routing, created = PackageRouting.objects.get_or_create(
    tenant_id=order.tenant_id,
    package_id=order.package_id,
    defaults={
        'id': uuid.uuid4(),
        'mode': 'auto',
        'provider_type': 'external',
        'primary_provider_id': str(diana.id)
    }
)

if not created:
    # Update existing routing
    routing.mode = 'auto'
    routing.provider_type = 'external'
    routing.primary_provider_id = str(diana.id)
    routing.save()
    print(f"\nRouting updated for package {order.package_id}")
else:
    print(f"\nRouting created for package {order.package_id}")

print(f"  Mode: {routing.mode}")
print(f"  Provider: {routing.primary_provider_id}")

# Now try to dispatch
print(f"\n🚀 Attempting to dispatch order to diana...")
try:
    result = try_auto_dispatch(str(order.id), str(order.tenant_id))
    print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")
