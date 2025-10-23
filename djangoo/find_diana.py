from apps.providers.models import Integration
from apps.tenancy.models import Tenant
from apps.orders.models import ProductOrder

# Get tenant
print("Finding tenant...")
tenant = Tenant.objects.all().first()
print(f"Tenant: {tenant.id} - {tenant.name}")

# Get providers
print("\nProviders:")
providers = Integration.objects.filter(tenant_id=tenant.id)
for p in providers:
    print(f"  {p.id} - {p.name} - {p.provider}")

# Find diana
diana = providers.filter(name__icontains='diana').first()
if diana:
    print(f"\nDIANA FOUND: {diana.id} - {diana.name}")
else:
    print("\nDIANA NOT FOUND")

# Get order
order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')
print(f"\nOrder: {order.id}")
print(f"Current provider_id: {order.provider_id}")
print(f"Status: {order.status}")
