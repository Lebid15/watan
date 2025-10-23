from apps.users.models import User
from apps.orders.models import ProductOrder
from django.contrib.auth.hashers import make_password

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CREATING NEW DIANA USER IN SHAMTECH TENANT")
print("="*70)

# Try to create with a different username first
try:
    diana_shamtech = User.objects.create(
        tenant_id=shamtech_tenant_id,
        username='diana_shamtech',  # Different username to avoid conflict
        password=make_password('diana123'),
        email='diana.shamtech@local.com',
        is_staff=False,
        is_active=True
    )
    print(f"✅ Created diana_shamtech user: ID={diana_shamtech.id}")
    
except Exception as e:
    print(f"Error creating diana_shamtech: {e}")
    # Try to find existing
    diana_shamtech = User.objects.filter(
        tenant_id=shamtech_tenant_id,
        username='diana_shamtech'
    ).first()
    
    if diana_shamtech:
        print(f"✅ Found existing diana_shamtech: ID={diana_shamtech.id}")

if diana_shamtech:
    print(f"\nDiana User in ShamTech:")
    print(f"  ID: {diana_shamtech.id}")
    print(f"  Username: {diana_shamtech.username}")
    print(f"  Tenant ID: {diana_shamtech.tenant_id}")
    print(f"  Match Tenant: {str(diana_shamtech.tenant_id) == shamtech_tenant_id}")
    
    # Update all orders in ShamTech
    print("\n" + "="*70)
    print("UPDATING ALL SHAMTECH ORDERS TO THIS USER")
    print("="*70)
    
    all_shamtech_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id)
    print(f"\nTotal orders in ShamTech: {all_shamtech_orders.count()}")
    
    updated_count = 0
    for order in all_shamtech_orders:
        if str(order.user_identifier) != str(diana_shamtech.id):
            order.user_identifier = str(diana_shamtech.id)
            order.save()
            updated_count += 1
            print(f"  Updated order {str(order.id)[-6:].upper()}")
    
    print(f"\n✅ Updated {updated_count} orders")
    
    # Verify our order
    our_order = ProductOrder.objects.get(id='c98ea6ff-a5ea-4945-8004-964089c51055')
    print(f"\nOur order C51055:")
    print(f"  User Identifier: {our_order.user_identifier}")
    print(f"  Diana User ID: {diana_shamtech.id}")
    print(f"  Tenant Match: {str(our_order.tenant_id) == shamtech_tenant_id}")
    print(f"  User Match: {str(our_order.user_identifier) == str(diana_shamtech.id)}")
    
    if str(our_order.user_identifier) == str(diana_shamtech.id) and str(our_order.tenant_id) == shamtech_tenant_id:
        print("\n✅✅✅ SUCCESS! Order is now properly linked to diana user in ShamTech!")
    else:
        print("\n❌ Something is still wrong")

print("\n" + "="*70)
