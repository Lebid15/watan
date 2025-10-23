from apps.orders.models import ProductOrder
from apps.integrations.models import Integration
from apps.providers.models import PackageRouting
import json

print("="*70)
print("CHECKING NEW ORDER 6AE27D")
print("="*70)

# Find the order by last 6 characters
all_orders = ProductOrder.objects.all().order_by('-created_at')

target_order = None
for order in all_orders[:50]:
    if str(order.id)[-6:].upper() == '6AE27D':
        target_order = order
        break

if not target_order:
    print("\n❌ Order 6AE27D not found in recent orders!")
    print("\nSearching all orders...")
    for order in ProductOrder.objects.all():
        if str(order.id)[-6:].upper() == '6AE27D':
            target_order = order
            break

if target_order:
    print(f"\n✅ FOUND ORDER!")
    print(f"\nOrder ID: {target_order.id}")
    print(f"Short ID: {str(target_order.id)[-6:].upper()}")
    print(f"Tenant ID: {target_order.tenant_id}")
    
    # Determine tenant name
    alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
    shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
    
    if str(target_order.tenant_id) == alsham_tenant_id:
        tenant_name = "ALSHAM (الشام)"
    elif str(target_order.tenant_id) == shamtech_tenant_id:
        tenant_name = "SHAMTECH (شام تيك)"
    else:
        tenant_name = f"OTHER ({target_order.tenant_id})"
    
    print(f"Tenant: {tenant_name}")
    print(f"\nUser Identifier: {target_order.user_identifier}")
    print(f"Status: {target_order.status}")
    print(f"External Status: {target_order.external_status}")
    print(f"Provider ID: {target_order.provider_id}")
    print(f"External Order ID: {target_order.external_order_id}")
    print(f"Package ID: {target_order.package_id}")
    print(f"Product ID: {target_order.product_id}")
    print(f"Price: ${target_order.price}")
    
    print(f"\nChain Path: {target_order.chain_path}")
    if target_order.chain_path:
        try:
            chain = json.loads(target_order.chain_path) if isinstance(target_order.chain_path, str) else target_order.chain_path
            print(f"Chain Length: {len(chain)}")
        except:
            pass
    
    print(f"\nCreated: {target_order.created_at}")
    
    # Check if it should have been forwarded
    print("\n" + "="*70)
    print("FORWARDING ANALYSIS")
    print("="*70)
    
    if str(target_order.tenant_id) == alsham_tenant_id:
        print("\n✅ Order is in ALSHAM - should be forwarded to ShamTech")
        
        # Check routing
        routing = PackageRouting.objects.filter(
            tenant_id=alsham_tenant_id,
            package_id=target_order.package_id
        ).first()
        
        if routing:
            print(f"\n✅ Routing found:")
            print(f"   Mode: {routing.mode}")
            print(f"   Provider Type: {routing.provider_type}")
            print(f"   Provider ID: {routing.provider_id}")
            
            if routing.mode == 'auto':
                print("\n✅ Auto mode - should forward automatically")
                
                if target_order.external_status == 'forwarded':
                    print("✅ Order WAS forwarded")
                    
                    # Find the forwarded order
                    if target_order.external_order_id and target_order.external_order_id.startswith('stub-'):
                        forwarded_id = target_order.external_order_id.replace('stub-', '')
                        print(f"\nLooking for forwarded order: {forwarded_id}")
                        
                        try:
                            forwarded_order = ProductOrder.objects.get(id=forwarded_id)
                            print(f"\n✅ FOUND FORWARDED ORDER!")
                            print(f"   Order ID: {str(forwarded_order.id)[-6:].upper()}")
                            print(f"   Tenant: {'SHAMTECH' if str(forwarded_order.tenant_id) == shamtech_tenant_id else 'OTHER'}")
                            print(f"   Status: {forwarded_order.status}")
                            print(f"   User Identifier: {forwarded_order.user_identifier}")
                        except ProductOrder.DoesNotExist:
                            print(f"\n❌ FORWARDED ORDER NOT FOUND!")
                else:
                    print(f"\n❌ Order NOT forwarded - external_status: {target_order.external_status}")
                    print("\nPossible reasons:")
                    print("  1. Auto-dispatch didn't run")
                    print("  2. Status was not PENDING")
                    print("  3. Provider ID already set")
                    print(f"\nCurrent provider_id: {target_order.provider_id}")
            else:
                print(f"\n⚠️ Manual mode - won't forward automatically")
        else:
            print("\n❌ No routing configured for this package!")
    
    elif str(target_order.tenant_id) == shamtech_tenant_id:
        print("\n✅ Order is already in SHAMTECH!")
    
else:
    print("\n❌ Order 6AE27D not found anywhere!")

print("\n" + "="*70)
