from apps.orders.models import ProductOrder
from apps.providers.models import Integration

# Get the order
order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')

# Get diana
diana = Integration.objects.get(tenant_id=order.tenant_id, name='diana')

# Update order to use diana provider
order.provider_id = diana.id
order.external_status = 'not_sent'
order.status = 'PENDING'
order.save(update_fields=['provider_id', 'external_status', 'status'])

print(f"✅ Order updated!")
print(f"  Order ID: {order.id}")
print(f"  Provider ID: {order.provider_id}")
print(f"  Provider Name: {diana.name}")
print(f"  Status: {order.status}")
print(f"  External Status: {order.external_status}")
