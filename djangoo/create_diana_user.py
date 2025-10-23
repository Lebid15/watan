from apps.users.models import User
from apps.orders.models import ProductOrder
from django.contrib.auth.hashers import make_password

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CREATING DIANA USER IN SHAMTECH")
print("="*70)

# Check if diana already exists
existing_diana = User.objects.filter(tenant_id=shamtech_tenant_id, username='diana').first()

if existing_diana:
    print(f"✅ Diana user already exists: ID={existing_diana.id}")
    diana_user = existing_diana
else:
    # Create diana user
    diana_user = User.objects.create(
        tenant_id=shamtech_tenant_id,
        username='diana',
        password=make_password('diana123'),  # Set a password
        email='diana@shamtech.local',
        is_staff=False,
        is_active=True
    )
    print(f"✅ Created diana user: ID={diana_user.id}")

print(f"\nDiana User Details:")
print(f"  ID: {diana_user.id}")
print(f"  Username: {diana_user.username}")
print(f"  Tenant ID: {diana_user.tenant_id}")

# Now update ALL orders in ShamTech that have user_identifier=1
print("\n" + "="*70)
print("UPDATING ORDERS TO DIANA USER")
print("="*70)

orders_to_update = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    user_identifier='1'
)

print(f"\nFound {orders_to_update.count()} orders with user_identifier='1'")

for order in orders_to_update:
    old_user = order.user_identifier
    order.user_identifier = str(diana_user.id)
    order.save()
    print(f"  Updated order {str(order.id)[-6:].upper()}: user_identifier {old_user} → {diana_user.id}")

print("\n✅ All orders updated successfully!")

# Verify our specific order
print("\n" + "="*70)
print("VERIFYING OUR ORDER")
print("="*70)

our_order = ProductOrder.objects.get(id='c98ea6ff-a5ea-4945-8004-964089c51055')
print(f"Order ID: {str(our_order.id)[-6:].upper()}")
print(f"User Identifier: {our_order.user_identifier}")
print(f"Expected User ID: {diana_user.id}")

if str(our_order.user_identifier) == str(diana_user.id):
    print("\n✅ SUCCESS! Order is now linked to diana user!")
else:
    print(f"\n❌ ERROR! Order user_identifier doesn't match diana user ID")

print("\n" + "="*70)
