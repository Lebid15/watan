from apps.orders.models import ProductOrder
from apps.users.models import User
from apps.tenancy.models import Tenant

# Get ShamTech tenant
shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CHECKING DIANA USER AND ORDER RELATIONSHIP")
print("="*70)

# Find all users in ShamTech
print("\nAll users in ShamTech tenant:")
shamtech_users = User.objects.filter(tenant_id=shamtech_tenant_id)
print(f"Total users: {shamtech_users.count()}")

for user in shamtech_users[:20]:
    print(f"  - ID: {user.id}, Username: {user.username}, Is Staff: {user.is_staff}")

# Check for diana user
diana_users = User.objects.filter(tenant_id=shamtech_tenant_id, username__icontains='diana')
print(f"\n'Diana' users found: {diana_users.count()}")
for user in diana_users:
    print(f"  ID: {user.id}, Username: {user.username}")

# Check our order
order_id = 'c98ea6ff-a5ea-4945-8004-964089c51055'
order = ProductOrder.objects.get(id=order_id)

print(f"\n" + "="*70)
print("OUR ORDER DETAILS")
print("="*70)
print(f"Order ID: {order.id}")
print(f"User Identifier: {order.user_identifier}")
print(f"Tenant ID: {order.tenant_id}")

# Check if user_identifier matches any user
print(f"\n" + "="*70)
print("CHECKING USER_IDENTIFIER")
print("="*70)

# user_identifier might be user.id or username
try:
    # Try as user ID
    user_by_id = User.objects.filter(id=order.user_identifier, tenant_id=shamtech_tenant_id).first()
    if user_by_id:
        print(f"✅ Found user by ID: {user_by_id.username} (ID: {user_by_id.id})")
    else:
        print(f"❌ No user found with ID: {order.user_identifier}")
        
        # Try as username
        user_by_username = User.objects.filter(username=order.user_identifier, tenant_id=shamtech_tenant_id).first()
        if user_by_username:
            print(f"✅ Found user by username: {user_by_username.username} (ID: {user_by_username.id})")
        else:
            print(f"❌ No user found with username: {order.user_identifier}")
            
except Exception as e:
    print(f"Error: {e}")

# Check the original order in Alsham
print(f"\n" + "="*70)
print("ORIGINAL ORDER IN ALSHAM")
print("="*70)

alsham_order_id = '2fd6924c-d783-4ae2-9946-0b7a3b7bafcd'
try:
    alsham_order = ProductOrder.objects.get(id=alsham_order_id)
    print(f"Order ID: {alsham_order.id}")
    print(f"User Identifier: {alsham_order.user_identifier}")
    print(f"Tenant ID: {alsham_order.tenant_id}")
    
    # Get the user from Alsham
    alsham_user = User.objects.filter(id=alsham_order.user_identifier, tenant_id=alsham_order.tenant_id).first()
    if alsham_user:
        print(f"\nOriginal User: {alsham_user.username} (ID: {alsham_user.id})")
    
except ProductOrder.DoesNotExist:
    print("Alsham order not found")

print("\n" + "="*70)
