from apps.orders.models import ProductOrder
from apps.users.models import User

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("COMPARING ORDERS: USER vs ADMIN VIEW")
print("="*70)

# Get all orders in ShamTech
all_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')

print(f"\nTotal orders in ShamTech: {all_orders.count()}")

if all_orders.count() > 0:
    print("\nOrder details:")
    for order in all_orders:
        print(f"\n  Order: {str(order.id)[-6:].upper()}")
        print(f"  User Identifier: {order.user_identifier}")
        print(f"  User ID: {order.user_id}")
        print(f"  Status: {order.status}")
        print(f"  Mode: {getattr(order, 'mode', 'N/A')}")
        print(f"  Created: {order.created_at}")

# Check users
print("\n" + "="*70)
print("USERS IN SHAMTECH")
print("="*70)

users = User.objects.filter(tenant_id=shamtech_tenant_id)
print(f"\nTotal users: {users.count()}")

for user in users:
    print(f"\n  ID: {user.id}")
    print(f"  Username: {user.username}")
    print(f"  Is Staff: {user.is_staff}")
    print(f"  Is Active: {user.is_active}")

print("\n" + "="*70)
print("DIAGNOSIS")
print("="*70)

print("\nThe issue:")
print("  - Forwarded orders have user_identifier = 20 (diana_shamtech)")
print("  - Admin panel might filter orders by user_id field instead")
print("  - Or orders need to be linked to an admin user")

print("\nSolution:")
print("  - Check if admin panel filters by user_id or user_identifier")
print("  - Forwarded orders might need user_id set in addition to user_identifier")

print("\n" + "="*70)
