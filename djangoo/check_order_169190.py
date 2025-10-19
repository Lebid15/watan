import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Checking Order 169190 in Halil")
print("=" * 80)

# Halil tenant
halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'

# Find order by order_no
order = ProductOrder.objects.filter(
    tenant_id=halil_tenant_id,
    order_no=169190
).first()

if order:
    print(f"\n✅ Found order in HALIL:")
    print(f"  Order ID: {order.id}")
    print(f"  Order No: {order.order_no}")
    print(f"  Package: {order.package.name if order.package else 'N/A'}")
    print(f"  Status: {order.status}")
    print(f"  Mode: {order.mode}")
    print(f"  External Status: {order.external_status}")
    print(f"  Provider ID: {order.provider_id or 'NOT SET'}")
    print(f"  External Order ID: {order.external_order_id or 'NOT SET'}")
    print(f"  Created: {order.created_at}")
    
    # Check if it was forwarded
    if order.root_order_id:
        print(f"\n  📤 Root Order ID: {order.root_order_id}")
        # Try to find where it was sent
        from django.db import connection
        cursor = connection.cursor()
        cursor.execute('''
            SELECT id, "tenantId", status, mode, provider_id, external_order_id
            FROM product_orders
            WHERE root_order_id = %s
            ORDER BY "createdAt" DESC
        ''', [str(order.id)])
        
        forwarded_orders = cursor.fetchall()
        if forwarded_orders:
            print(f"\n  📥 This order was forwarded to:")
            for fo in forwarded_orders:
                print(f"    - Order ID: {fo[0]}")
                print(f"      Tenant: {fo[1]}")
                print(f"      Status: {fo[2]}")
                print(f"      Mode: {fo[3]}")
                print(f"      Provider ID: {fo[4] or 'NOT SET'}")
        cursor.close()
    else:
        print(f"\n  ❌ Root Order ID: NOT SET (order hasn't been forwarded yet)")
    
    # Check alsham
    alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
    alsham_order = ProductOrder.objects.filter(
        root_order_id=order.id,
        tenant_id=alsham_tenant_id
    ).first()
    
    if alsham_order:
        print(f"\n  ✅ Order WAS forwarded to ALSHAM:")
        print(f"    Order ID: {alsham_order.id}")
        print(f"    Status: {alsham_order.status}")
        print(f"    Provider ID: {alsham_order.provider_id or 'NOT SET'}")
    else:
        print(f"\n  ❌ Order NOT forwarded to ALSHAM yet!")
        print(f"\n  💡 You need to DISPATCH this order from halil to alsham:")
        print(f"     1. Go to: http://halil.localhost:3000/admin/orders/{order.id}")
        print(f"     2. Click 'Dispatch' or 'Forward'")
        print(f"     3. Select provider: alsham")
        print(f"     4. Submit")
else:
    print(f"\n❌ Order 169190 NOT found in halil!")
    print(f"   Checking if it exists anywhere...")
    
    all_orders = ProductOrder.objects.filter(order_no=169190)
    if all_orders.exists():
        print(f"\n  Found {all_orders.count()} order(s) with order_no 169190:")
        for o in all_orders:
            print(f"    - Tenant: {o.tenant_id}")
            print(f"      Order ID: {o.id}")
            print(f"      Status: {o.status}")

print("\n" + "=" * 80)
