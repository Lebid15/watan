from apps.orders.models import ProductOrder
import json

print("="*70)
print("CHECKING NEW ORDER 9B52B4")
print("="*70)

# Find the order
all_orders = ProductOrder.objects.all().order_by('-created_at')

target_order = None
for order in all_orders[:20]:
    if str(order.id)[-6:].upper() == '9B52B4':
        target_order = order
        break

if target_order:
    print(f"\n✅ FOUND ORDER!")
    print(f"\nOrder ID: {target_order.id}")
    print(f"Short ID: {str(target_order.id)[-6:].upper()}")
    
    alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
    shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
    
    if str(target_order.tenant_id) == alsham_tenant_id:
        tenant_name = "ALSHAM"
    elif str(target_order.tenant_id) == shamtech_tenant_id:
        tenant_name = "SHAMTECH"
    else:
        tenant_name = "OTHER"
    
    print(f"Tenant: {tenant_name} ({target_order.tenant_id})")
    print(f"\nUser Identifier: {target_order.user_identifier}")
    print(f"Status: {target_order.status}")
    print(f"External Status: {target_order.external_status}")
    print(f"Provider ID: {target_order.provider_id}")
    print(f"External Order ID: {target_order.external_order_id}")
    print(f"Package ID: {target_order.package_id}")
    print(f"Price: ${target_order.price}")
    print(f"Created: {target_order.created_at}")
    
    if target_order.chain_path:
        try:
            chain = json.loads(target_order.chain_path) if isinstance(target_order.chain_path, str) else target_order.chain_path
            print(f"\nChain Path: {chain}")
            print(f"Chain Length: {len(chain)}")
        except Exception as e:
            print(f"\nChain Path (raw): {target_order.chain_path}")
    
    # Check if forwarded
    print("\n" + "="*70)
    print("FORWARDING STATUS")
    print("="*70)
    
    if target_order.external_status == 'forwarded':
        print("\n✅ Order was marked as FORWARDED")
        
        if target_order.external_order_id and target_order.external_order_id.startswith('stub-'):
            forwarded_id = target_order.external_order_id.replace('stub-', '')
            print(f"\nForwarded Order ID: {forwarded_id}")
            print(f"Short ID: {forwarded_id[-6:].upper()}")
            
            # Try to find the forwarded order
            try:
                forwarded_order = ProductOrder.objects.get(id=forwarded_id)
                
                if str(forwarded_order.tenant_id) == shamtech_tenant_id:
                    fwd_tenant = "SHAMTECH ✅"
                else:
                    fwd_tenant = f"OTHER TENANT ❌ ({forwarded_order.tenant_id})"
                
                print(f"\n✅ FOUND FORWARDED ORDER!")
                print(f"   Tenant: {fwd_tenant}")
                print(f"   Status: {forwarded_order.status}")
                print(f"   User Identifier: {forwarded_order.user_identifier}")
                print(f"   Created: {forwarded_order.created_at}")
                
            except ProductOrder.DoesNotExist:
                print(f"\n❌ FORWARDED ORDER NOT FOUND!")
                print(f"   The order was marked as forwarded but the child order doesn't exist!")
        else:
            print(f"\n⚠️ External Order ID doesn't start with 'stub-': {target_order.external_order_id}")
    else:
        print(f"\n❌ Order NOT forwarded!")
        print(f"   External Status: {target_order.external_status}")
        print(f"\nPossible reasons:")
        print(f"   1. Auto-dispatch didn't run")
        print(f"   2. Status is not PENDING (current: {target_order.status})")
        print(f"   3. Provider ID already set (current: {target_order.provider_id})")
        print(f"   4. No routing configured")

else:
    print("\n❌ Order 9B52B4 NOT FOUND!")
    print(f"\nTotal orders in database: {all_orders.count()}")
    
    if all_orders.count() > 0:
        print("\nRecent orders:")
        for i, order in enumerate(all_orders[:5], 1):
            print(f"  {i}. {str(order.id)[-6:].upper()} - Created: {order.created_at}")

print("\n" + "="*70)
