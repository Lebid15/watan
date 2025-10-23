from apps.users.models import User
from apps.orders.models import ProductOrder

print("="*70)
print("FINDING DIANA USER")
print("="*70)

# Find ALL diana users across ALL tenants
all_diana_users = User.objects.filter(username='diana')
print(f"\nTotal 'diana' users found: {all_diana_users.count()}")

for user in all_diana_users:
    print(f"\n  ID: {user.id}")
    print(f"  Username: {user.username}")
    print(f"  Tenant ID: {user.tenant_id}")
    print(f"  Email: {user.email}")
    print(f"  Is Active: {user.is_active}")

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

# Find diana in ShamTech specifically
diana_shamtech = User.objects.filter(username='diana', tenant_id=shamtech_tenant_id).first()

if diana_shamtech:
    print(f"\n✅ Found diana in ShamTech tenant: ID={diana_shamtech.id}")
    diana_user = diana_shamtech
else:
    # Find diana in other tenant
    diana_other = User.objects.filter(username='diana').first()
    if diana_other:
        print(f"\n⚠️ Diana exists in different tenant: {diana_other.tenant_id}")
        print(f"   We need to use this diana's ID: {diana_other.id}")
        diana_user = diana_other
    else:
        print("\n❌ No diana user found at all!")
        diana_user = None

if diana_user:
    print("\n" + "="*70)
    print("UPDATING ORDERS")
    print("="*70)
    
    # Update orders that have user_identifier=1 in ShamTech
    orders_to_update = ProductOrder.objects.filter(
        tenant_id=shamtech_tenant_id,
        user_identifier='1'
    )
    
    print(f"\nFound {orders_to_update.count()} orders to update")
    
    for order in orders_to_update:
        print(f"  Updating order {str(order.id)[-6:].upper()}...")
        order.user_identifier = str(diana_user.id)
        order.save()
    
    print("\n✅ All orders updated!")
    
    # Verify
    our_order = ProductOrder.objects.get(id='c98ea6ff-a5ea-4945-8004-964089c51055')
    print(f"\nOur order C51055:")
    print(f"  User Identifier: {our_order.user_identifier}")
    print(f"  Diana User ID: {diana_user.id}")
    print(f"  Match: {str(our_order.user_identifier) == str(diana_user.id)}")

print("\n" + "="*70)
