from apps.orders.models import ProductOrder

order = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')

print(f"Order Status: {order.status}")
print(f"Status Type: {type(order.status)}")
print(f"Status == 'pending': {order.status == 'pending'}")
print(f"Status == 'PENDING': {order.status == 'PENDING'}")
print(f"Status != 'pending': {order.status != 'pending'}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")

is_stub_forward = order.external_order_id and order.external_order_id.startswith('stub-')
print(f"\nis_stub_forward: {is_stub_forward}")

# The actual condition
will_skip = not is_stub_forward and order.provider_id and order.status != 'pending'
print(f"\nWill skip dispatch? {will_skip}")
print(f"  not is_stub_forward: {not is_stub_forward}")
print(f"  order.provider_id: {order.provider_id}")
print(f"  order.status != 'pending': {order.status != 'pending'}")
