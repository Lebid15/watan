from apps.orders.models import ProductOrder
from apps.users.models import User

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CHECKING FORWARDED ORDER IN SHAMTECH")
print("="*70)

# The forwarded order ID
forwarded_id = '03f0abb9-1b75-414f-8e66-15795a3e1fcb'

try:
    forwarded_order = ProductOrder.objects.get(id=forwarded_id)
    
    print(f"\n✅ FOUND FORWARDED ORDER!")
    print(f"\nOrder ID: {forwarded_order.id}")
    print(f"Short ID: {str(forwarded_order.id)[-6:].upper()}")
    print(f"Tenant ID: {forwarded_order.tenant_id}")
    
    if str(forwarded_order.tenant_id) == shamtech_tenant_id:
        print("✅ Order IS in SHAMTECH!")
    else:
        print(f"❌ Order is in DIFFERENT tenant: {forwarded_order.tenant_id}")
    
    print(f"\nUser Identifier: {forwarded_order.user_identifier}")
    print(f"Status: {forwarded_order.status}")
    print(f"External Status: {forwarded_order.external_status}")
    print(f"Provider ID: {forwarded_order.provider_id}")
    print(f"Package ID: {forwarded_order.package_id}")
    print(f"Price: ${forwarded_order.price}")
    print(f"Created: {forwarded_order.created_at}")
    
    # Check user
    print("\n" + "="*70)
    print("USER CHECK")
    print("="*70)
    
    diana_user = User.objects.filter(tenant_id=shamtech_tenant_id, username='diana_shamtech').first()
    
    if diana_user:
        print(f"\nDiana user ID: {diana_user.id}")
        print(f"Order user_identifier: {forwarded_order.user_identifier}")
        
        if str(forwarded_order.user_identifier) == str(diana_user.id):
            print("\n✅ Order is linked to diana_shamtech user!")
            print("✅ Should appear in ShamTech frontend!")
        else:
            print(f"\n❌ Order is NOT linked to diana user!")
            print(f"   Order has user_identifier: {forwarded_order.user_identifier}")
            print(f"   Diana user ID: {diana_user.id}")
            
            # Update it
            print("\n🔧 FIXING: Updating order to diana user...")
            forwarded_order.user_identifier = str(diana_user.id)
            forwarded_order.save()
            print("✅ Updated!")
    else:
        print("\n❌ Diana user not found!")

except ProductOrder.DoesNotExist:
    print(f"\n❌ Forwarded order {forwarded_id} NOT FOUND!")
    print("\nThis means the order was marked as forwarded but the child order was not created!")

print("\n" + "="*70)
