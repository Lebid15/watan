from apps.orders.models import ProductOrder
import traceback

print("="*70)
print("CHECKING ORDER C020A8")
print("="*70)

try:
    # Find order
    all_orders = ProductOrder.objects.all().order_by('-created_at')
    
    target_order = None
    for order in all_orders[:20]:
        if str(order.id)[-6:].upper() == 'C020A8':
            target_order = order
            break
    
    if target_order:
        print(f"\n✅ Found order!")
        print(f"   ID: {target_order.id}")
        print(f"   Tenant: {target_order.tenant_id}")
        print(f"   Status: {target_order.status}")
        print(f"   External Status: {target_order.external_status}")
        print(f"   Provider ID: {target_order.provider_id}")
        print(f"   External Order ID: {target_order.external_order_id}")
        print(f"   User ID: {target_order.user_id}")
        print(f"   User Identifier: {target_order.user_identifier}")
        
        alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
        shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
        
        if str(target_order.tenant_id) == alsham_tenant_id:
            print(f"\n   Order is in ALSHAM")
            
            # Check if forwarded
            if target_order.external_status == 'forwarded':
                print(f"\n   ✅ Order was forwarded")
                
                if target_order.external_order_id and target_order.external_order_id.startswith('stub-'):
                    fwd_id = target_order.external_order_id.replace('stub-', '')
                    print(f"\n   Looking for forwarded order: {fwd_id[-6:].upper()}")
                    
                    try:
                        fwd_order = ProductOrder.objects.get(id=fwd_id)
                        print(f"\n   ✅ FOUND in ShamTech!")
                        print(f"      Tenant: {fwd_order.tenant_id}")
                        print(f"      User ID: {fwd_order.user_id}")
                        print(f"      User Identifier: {fwd_order.user_identifier}")
                    except ProductOrder.DoesNotExist:
                        print(f"\n   ❌ Forwarded order NOT FOUND!")
            else:
                print(f"\n   ❌ Order NOT forwarded")
                print(f"      External Status: {target_order.external_status}")
    else:
        print(f"\n❌ Order C020A8 not found!")
        print(f"\nTotal orders: {all_orders.count()}")
        
        if all_orders.count() > 0:
            print("\nRecent orders:")
            for i, order in enumerate(all_orders[:5], 1):
                print(f"  {i}. {str(order.id)[-6:].upper()}")
                
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nFull traceback:")
    traceback.print_exc()

print("\n" + "="*70)
