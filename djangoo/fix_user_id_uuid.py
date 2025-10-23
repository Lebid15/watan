from apps.orders.models import ProductOrder
from apps.users.models import User
import uuid

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("FIXING ORDER user_id WITH CORRECT UUID")
print("="*70)

# Get diana user
diana = User.objects.filter(tenant_id=shamtech_tenant_id, username='diana_shamtech').first()

if diana:
    print(f"\n✅ Diana user found:")
    print(f"   ID (integer): {diana.id}")
    print(f"   ID type: {type(diana.id)}")
    
    # Get diana's UUID from database
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM dj_users WHERE username = 'diana_shamtech'")
        row = cursor.fetchone()
        if row:
            diana_uuid = row[0]
            print(f"   UUID from DB: {diana_uuid}")
            print(f"   UUID type: {type(diana_uuid)}")
        else:
            diana_uuid = None
            print("   ❌ UUID not found in DB!")
    
    if diana_uuid:
        # Get the order
        order = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).first()
        
        if order:
            print(f"\n✅ Found order: {str(order.id)[-6:].upper()}")
            print(f"   Current user_id: {order.user_id}")
            
            # Update with UUID
            order.user_id = diana_uuid
            order.save()
            
            print(f"\n✅ Updated user_id to: {diana_uuid}")
            print("\n✅✅✅ SUCCESS! Refresh admin panel now!")
        else:
            print("\n❌ No order found!")
else:
    print("\n❌ Diana user not found!")

print("\n" + "="*70)
