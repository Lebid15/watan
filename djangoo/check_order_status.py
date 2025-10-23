from apps.orders.models import ProductOrder
from apps.providers.models import Integration

order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')
provider = Integration.objects.get(id=order.provider_id) if order.provider_id else None

print(f"{'='*60}")
print(f"📦 ORDER STATUS")
print(f"{'='*60}")
print(f"Order ID: {order.id}")
print(f"Order No: {str(order.id)[-6:].upper()}")
print(f"Status: {order.status}")
print(f"External Status: {order.external_status}")
print(f"Provider ID: {order.provider_id}")
print(f"Provider Name: {provider.name if provider else 'N/A'}")
print(f"Provider Type: {provider.provider if provider else 'N/A'}")
print(f"Package ID: {order.package_id}")
print(f"User ID: {order.user_identifier}")
print(f"{'='*60}")
