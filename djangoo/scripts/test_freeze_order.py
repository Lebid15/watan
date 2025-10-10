"""
Test script to manually freeze a specific order
Run: python manage.py shell
Then: exec(open('scripts/test_freeze_order.py').read())
"""
from apps.orders.models import ProductOrder
from apps.orders.services import freeze_fx_on_approval

# Get the latest approved order
order = ProductOrder.objects.filter(status='approved').order_by('-created_at').first()

if not order:
    print("❌ No approved orders found")
else:
    print(f"📋 Order ID: {order.id}")
    print(f"   Status: {order.status}")
    print(f"   FX Locked: {order.fx_locked}")
    print(f"   Cost TRY (before): {order.cost_try_at_approval}")
    print(f"   Sell TRY (before): {order.sell_try_at_approval}")
    
    if not order.fx_locked:
        print("\n🔄 Freezing FX rates...")
        freeze_fx_on_approval(str(order.id))
        
        # Refresh from DB
        order.refresh_from_db()
        
        print(f"\n✅ After freezing:")
        print(f"   FX Locked: {order.fx_locked}")
        print(f"   FX Rate: {order.fx_usd_try_at_approval}")
        print(f"   Cost TRY: {order.cost_try_at_approval}")
        print(f"   Sell TRY: {order.sell_try_at_approval}")
        print(f"   Profit TRY: {order.profit_try_at_approval}")
    else:
        print("\n✅ Order already frozen!")
        print(f"   FX Rate: {order.fx_usd_try_at_approval}")
        print(f"   Cost TRY: {order.cost_try_at_approval}")
        print(f"   Sell TRY: {order.sell_try_at_approval}")
