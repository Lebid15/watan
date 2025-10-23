from apps.orders.models import ProductOrder
from apps.users.models import User

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("DEBUGGING ADMIN ORDERS API FOR SHAMTECH")
print("="*70)

# Get the order
order = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).first()

if order:
    print(f"\n✅ Order exists:")
    print(f"   ID: {order.id}")
    print(f"   Short: {str(order.id)[-6:].upper()}")
    print(f"   Tenant ID: {order.tenant_id}")
    print(f"   User ID: {order.user_id}")
    print(f"   User Identifier: {order.user_identifier}")
    print(f"   Status: {order.status}")
    print(f"   External Status: {order.external_status}")
    print(f"   Package ID: {order.package_id}")
    print(f"   Product ID: {order.product_id}")
    print(f"   Created: {order.created_at}")
    
    # Check if user exists
    print("\n" + "="*70)
    print("CHECKING RELATED USER")
    print("="*70)
    
    try:
        user = User.objects.get(id=order.user_id)
        print(f"\n✅ User found by user_id:")
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Tenant: {user.tenant_id}")
        print(f"   Tenant Match: {str(user.tenant_id) == shamtech_tenant_id}")
        
        if str(user.tenant_id) != shamtech_tenant_id:
            print(f"\n❌ PROBLEM: User belongs to DIFFERENT tenant!")
            print(f"   Order tenant: {shamtech_tenant_id}")
            print(f"   User tenant: {user.tenant_id}")
            print("\n   This means order.user_id points to a user in Alsham!")
            print("   Admin API might filter out orders with cross-tenant users!")
    except User.DoesNotExist:
        print(f"\n⚠️ User with ID {order.user_id} NOT FOUND!")
    
    # Check package
    print("\n" + "="*70)
    print("CHECKING PACKAGE")
    print("="*70)
    
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, name, tenant_id FROM packages WHERE id = %s", [str(order.package_id)])
        pkg = cursor.fetchone()
        if pkg:
            print(f"\n✅ Package found:")
            print(f"   ID: {pkg[0]}")
            print(f"   Name: {pkg[1]}")
            print(f"   Tenant: {pkg[2]}")
            print(f"   Tenant Match: {pkg[2] == shamtech_tenant_id}")
            
            if pkg[2] != shamtech_tenant_id:
                print(f"\n❌ PROBLEM: Package belongs to DIFFERENT tenant!")
                print("   This might cause the order to be filtered out!")
        else:
            print(f"\n❌ Package {order.package_id} NOT FOUND!")
    
    # Check product
    print("\n" + "="*70)
    print("CHECKING PRODUCT")
    print("="*70)
    
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, name FROM products WHERE id = %s", [str(order.product_id)])
        prod = cursor.fetchone()
        if prod:
            print(f"\n✅ Product found:")
            print(f"   ID: {prod[0]}")
            print(f"   Name: {prod[1]}")
        else:
            print(f"\n❌ Product {order.product_id} NOT FOUND!")
    
else:
    print("\n❌ NO ORDERS IN SHAMTECH!")

print("\n" + "="*70)
print("SOLUTION")
print("="*70)
print("\nThe issue is likely:")
print("  - order.user_id points to a user in Alsham (different tenant)")
print("  - Admin API joins with users table and filters by tenant")
print("  - This causes the order to not appear in results")
print("\nFix: Update order.user_id to point to diana_shamtech user (ID: 20)")

print("\n" + "="*70)
