import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Understanding the Order Flow: Halil → Alsham")
print("=" * 80)

# The order you mentioned
alsham_order = ProductOrder.objects.filter(
    id__startswith='65f86844'
).first()

if alsham_order:
    print(f"\n📦 Order 65f86844 in ALSHAM:")
    print(f"  Order ID: {alsham_order.id}")
    print(f"  Tenant: alsham")
    print(f"  Status: {alsham_order.status}")
    print(f"  Mode: {alsham_order.mode}")
    print(f"  Root Order ID: {alsham_order.root_order_id or 'NULL ❌'}")
    print(f"  Provider ID: {alsham_order.provider_id or 'NULL'}")
    print(f"  External Order ID: {alsham_order.external_order_id or 'NULL'}")
    print(f"  Created: {alsham_order.created_at}")
    
    if not alsham_order.root_order_id:
        print(f"\n  ❌ Problem: root_order_id is NULL!")
        print(f"     This means the order was NOT forwarded from halil!")
        print(f"     It was created directly in alsham.")
        print(f"\n  💡 For Celery to track halil → alsham:")
        print(f"     1. Create order in HALIL first")
        print(f"     2. Dispatch from halil → alsham")
        print(f"     3. This creates a NEW order in alsham WITH root_order_id")
        print(f"     4. Celery checks the alsham order (with provider_id set to halil)")
        print(f"     5. When alsham order completes, halil order updates automatically!")
    else:
        print(f"\n  ✅ Order was forwarded from halil (root_order_id: {alsham_order.root_order_id})")
        print(f"\n  Checking root order in halil...")
        
        # Find the root order
        halil_order = ProductOrder.objects.filter(id=alsham_order.root_order_id).first()
        if halil_order:
            print(f"\n  📦 Root Order in HALIL:")
            print(f"    Order ID: {halil_order.id}")
            print(f"    Status: {halil_order.status}")
            print(f"    Provider ID: {halil_order.provider_id or 'NULL'}")
            print(f"    External Order ID: {halil_order.external_order_id or 'NULL'}")

# Check halil orders
print(f"\n" + "=" * 80)
print("📦 Checking HALIL for any orders:")
print("=" * 80)

halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'
halil_orders = ProductOrder.objects.filter(
    tenant_id=halil_tenant_id
).order_by('-created_at')[:5]

if halil_orders.exists():
    for order in halil_orders:
        print(f"\n  Order: {str(order.id)[:8]}")
        print(f"    Status: {order.status}")
        print(f"    Provider ID: {order.provider_id or 'NULL'}")
        print(f"    Created: {order.created_at}")
else:
    print(f"\n  ❌ NO ORDERS in halil!")
    print(f"\n  💡 This confirms:")
    print(f"     - You created the order while logged into ALSHAM, not HALIL")
    print(f"     - To test halil → alsham flow:")
    print(f"       1. Go to http://halil.localhost:3000")
    print(f"       2. Create a NEW order there")
    print(f"       3. Dispatch it to alsham")
    print(f"       4. Celery will track it!")

print("\n" + "=" * 80)
print("\n🎯 CORRECT Flow for Testing:")
print("=" * 80)
print("""
1️⃣ Create order in HALIL:
   - Go to: http://halil.localhost:3000
   - Create order (pubg global 325)
   - Mode: Manual
   - This creates order in HALIL only

2️⃣ Dispatch from HALIL → ALSHAM:
   - In halil admin: find the order
   - Click "Dispatch" or "Forward"
   - Select provider: "alsham"
   - This creates:
     * Order in ALSHAM (with root_order_id = halil_order.id)
     * HALIL order gets provider_id = "alsham"
     * HALIL order gets external_order_id = alsham_order.id

3️⃣ Celery tracks HALIL order:
   - Celery checks orders with provider_id set
   - Finds HALIL order (provider_id = "alsham")
   - Checks status from ALSHAM
   - Updates HALIL order when ALSHAM order changes!

4️⃣ (Optional) ALSHAM processes order:
   - Alsham can forward to shamtech OR
   - Alsham can process manually
   - Either way, when alsham order completes → halil order completes!
""")
print("=" * 80)
