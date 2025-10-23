from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

order_id = '2e8c1bdf-96e0-485e-863b-953bc4c020a8'

print("="*70)
print("MANUALLY DISPATCHING ORDER C020A8")
print("="*70)

try:
    order = ProductOrder.objects.get(id=order_id)
    
    print(f"\n✅ Found order: {str(order.id)[-6:].upper()}")
    print(f"   Status: {order.status}")
    print(f"   External Status: {order.external_status}")
    
    # Try auto dispatch
    print("\n🚀 Attempting auto-dispatch...")
    
    result = try_auto_dispatch(order.id)  # Pass ID, not object
    
    # Refresh from DB
    order.refresh_from_db()
    
    print(f"\n✅ Dispatch completed!")
    print(f"   New Status: {order.status}")
    print(f"   New External Status: {order.external_status}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   External Order ID: {order.external_order_id}")
    
    if order.external_status == 'forwarded':
        print(f"\n✅✅✅ SUCCESS! Order was forwarded!")
        
        if order.external_order_id and order.external_order_id.startswith('stub-'):
            fwd_id = order.external_order_id.replace('stub-', '')
            print(f"\n   Forwarded to: {fwd_id[-6:].upper()}")
            
            try:
                fwd_order = ProductOrder.objects.get(id=fwd_id)
                print(f"\n   ✅ Forwarded order found in ShamTech!")
                print(f"      User ID: {fwd_order.user_id}")
                print(f"      User Identifier: {fwd_order.user_identifier}")
            except ProductOrder.DoesNotExist:
                print(f"\n   ❌ Forwarded order not found!")
    else:
        print(f"\n⚠️ Order was NOT forwarded")
        print(f"   Check logs for details")
        
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
