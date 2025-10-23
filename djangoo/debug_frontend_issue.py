from apps.orders.models import ProductOrder
from apps.users.models import User

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("DEBUGGING FRONTEND DISPLAY ISSUE")
print("="*70)

# Check diana user
diana_user = User.objects.filter(tenant_id=shamtech_tenant_id, username='diana_shamtech').first()

if diana_user:
    print(f"\n✅ Diana User:")
    print(f"   ID: {diana_user.id}")
    print(f"   Username: {diana_user.username}")
    print(f"   Email: {diana_user.email}")
    print(f"   Is Active: {diana_user.is_active}")
    print(f"   Is Staff: {diana_user.is_staff}")
    print(f"   Tenant ID: {diana_user.tenant_id}")
    
    # Check orders for this user
    diana_orders = ProductOrder.objects.filter(
        tenant_id=shamtech_tenant_id,
        user_identifier=str(diana_user.id)
    ).order_by('-created_at')
    
    print(f"\n📊 Orders for diana_shamtech user:")
    print(f"   Total: {diana_orders.count()}")
    
    if diana_orders.count() > 0:
        print("\n   Recent orders:")
        for i, order in enumerate(diana_orders[:5], 1):
            print(f"   {i}. {str(order.id)[-6:].upper()} - Status: {order.status} - Created: {order.created_at}")
    else:
        print("   ❌ NO ORDERS FOUND!")
        
        # Check if there are orders with wrong user_identifier
        all_shamtech_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')
        print(f"\n   Total orders in ShamTech (all users): {all_shamtech_orders.count()}")
        
        if all_shamtech_orders.count() > 0:
            print("\n   User identifiers in recent orders:")
            user_ids = set()
            for order in all_shamtech_orders[:10]:
                user_ids.add(order.user_identifier)
                print(f"   - Order {str(order.id)[-6:].upper()}: user_identifier = {order.user_identifier}")
            
            print(f"\n   Unique user_identifiers: {user_ids}")
            print(f"   Diana user ID: {diana_user.id}")
            
            if str(diana_user.id) not in [str(uid) for uid in user_ids]:
                print("\n   ❌ PROBLEM: No orders linked to diana user!")
else:
    print("\n❌ Diana user NOT FOUND!")
    
    # Check what users exist
    all_users = User.objects.filter(tenant_id=shamtech_tenant_id)
    print(f"\nTotal users in ShamTech: {all_users.count()}")
    for user in all_users:
        print(f"  - ID: {user.id}, Username: {user.username}")

print("\n" + "="*70)
print("CHECKING FRONTEND API ENDPOINT")
print("="*70)

# Simulate what the frontend would query
print("\nWhat frontend likely queries:")
print(f"  Tenant: {shamtech_tenant_id}")
if diana_user:
    print(f"  User ID: {diana_user.id}")
    print(f"  Filter: tenant_id={shamtech_tenant_id}, user_id={diana_user.id}")
    
    # Try different query patterns
    print("\nTrying different query patterns:")
    
    # Query 1: By user_id (not user_identifier!)
    orders_by_user_id = ProductOrder.objects.filter(
        tenant_id=shamtech_tenant_id,
        user_id=diana_user.id
    )
    print(f"\n  1. Filter by user_id: {orders_by_user_id.count()} orders")
    
    # Query 2: By user_identifier
    orders_by_user_identifier = ProductOrder.objects.filter(
        tenant_id=shamtech_tenant_id,
        user_identifier=str(diana_user.id)
    )
    print(f"  2. Filter by user_identifier: {orders_by_user_identifier.count()} orders")
    
    # Query 3: Just tenant (admin view)
    orders_by_tenant = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id)
    print(f"  3. Filter by tenant only: {orders_by_tenant.count()} orders")

print("\n" + "="*70)
