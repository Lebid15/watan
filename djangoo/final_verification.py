from apps.orders.models import ProductOrder
from apps.users.models import User

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
diana_user = User.objects.get(tenant_id=shamtech_tenant_id, username='diana_shamtech')

print("="*70)
print("FINAL VERIFICATION - WHAT SHOULD APPEAR IN FRONTEND")
print("="*70)

print(f"\nShamTech Tenant ID: {shamtech_tenant_id}")
print(f"Diana User ID: {diana_user.id}")
print(f"Diana Username: {diana_user.username}")

print("\n" + "="*70)
print("ORDERS THAT SHOULD APPEAR FOR DIANA USER")
print("="*70)

diana_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    user_identifier=str(diana_user.id)
).order_by('-created_at')

print(f"\nTotal orders for diana: {diana_orders.count()}")

print("\nFirst 5 orders:")
for i, order in enumerate(diana_orders[:5], 1):
    print(f"\n{i}. Order #{str(order.id)[-6:].upper()}")
    print(f"   Status: {order.status}")
    print(f"   External Status: {order.external_status}")
    print(f"   Created: {order.created_at}")
    print(f"   Package ID: {order.package_id}")

# Check our specific order
our_order = ProductOrder.objects.get(id='c98ea6ff-a5ea-4945-8004-964089c51055')

print("\n" + "="*70)
print("OUR SPECIFIC ORDER C51055")
print("="*70)
print(f"Order ID: {our_order.id}")
print(f"Tenant ID: {our_order.tenant_id} ({'✅ ShamTech' if str(our_order.tenant_id) == shamtech_tenant_id else '❌ Wrong tenant'})")
print(f"User Identifier: {our_order.user_identifier} ({'✅ Diana' if str(our_order.user_identifier) == str(diana_user.id) else '❌ Wrong user'})")
print(f"Status: {our_order.status}")
print(f"External Status: {our_order.external_status}")
print(f"Package ID: {our_order.package_id}")
print(f"Price: {order.price}")

print("\n" + "="*70)
print("✅ READY! Refresh the frontend to see the order!")
print("="*70)
