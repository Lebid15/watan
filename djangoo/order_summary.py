import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

print("=" * 80)
print("🔍 Summary: Where is Order 169190?")
print("=" * 80)

# Check order 65f86844 (the PENDING one in alsham from 12:59)
cursor.execute('''
    SELECT 
        id, "tenantId", "orderNo", status, mode, 
        "providerId", "externalOrderId", "createdAt",
        root_order_id
    FROM product_orders
    WHERE id::text LIKE '65f86844%'
''')

order = cursor.fetchone()
if order:
    print(f"\n✅ Found PENDING order in ALSHAM:")
    print(f"  Order ID: {str(order[0])[:8]}")
    print(f"  Order No: {order[2] or 'NULL'}")
    print(f"  Status: {order[3]}")
    print(f"  Mode: {order[4]}")
    print(f"  Provider ID: {order[5] or 'NOT SET ❌'}")
    print(f"  External Order ID: {order[6] or 'NOT SET ❌'}")
    print(f"  Root Order ID: {order[8] or 'NULL'}")
    print(f"  Created: {order[7]}")
    
    print(f"\n💡 Analysis:")
    if not order[5]:
        print(f"  ❌ Order has NOT been dispatched yet!")
        print(f"  📝 This is why Celery doesn't check it.")
        print(f"  📝 This is why it doesn't show in alsham notifications.")
        print(f"\n  🎯 Solution:")
        print(f"     1. The order IS in alsham database")
        print(f"     2. But it needs to be DISPATCHED to a provider (diana/shamtech)")
        print(f"     3. After dispatch, Celery will start checking it!")
    
    if not order[8]:
        print(f"\n  ℹ️ This order was created DIRECTLY in alsham (no root_order_id)")
        print(f"     It was NOT forwarded from halil")
        print(f"     This means you created it while logged into alsham, not halil!")

cursor.close()

print("\n" + "=" * 80)
print("\n🎯 Next Steps:")
print("  1. Go to: http://alsham.localhost:3000/admin/orders")
print("  2. Find order 65f86844")
print("  3. Click 'Dispatch' or 'إرسال'")
print("  4. Select provider: diana (shamtech)")
print("  5. Submit")
print("  6. Watch Celery logs - it will start checking the order every 30 seconds!")
print("\n" + "=" * 80)
