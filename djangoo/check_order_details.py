from apps.orders.models import ProductOrder
import json

order_id = 'c98ea6ff-a5ea-4945-8004-964089c51055'
order = ProductOrder.objects.get(id=order_id)

print("="*70)
print("FULL ORDER DETAILS FOR C51055")
print("="*70)

print(f"\nID: {order.id}")
print(f"Tenant ID: {order.tenant_id}")
print(f"User Identifier: {order.user_identifier}")
print(f"Status: {order.status}")
print(f"External Status: {order.external_status}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")

print(f"\nPackage ID: {order.package_id}")
print(f"Package Name: {order.package_name}")
print(f"Product ID: {order.product_id}")

print(f"\nCost: {order.cost}")
print(f"Price: {order.price}")
print(f"Profit: {order.profit}")

print(f"\nChain Path: {order.chain_path}")
if order.chain_path:
    try:
        chain = json.loads(order.chain_path) if isinstance(order.chain_path, str) else order.chain_path
        print(f"Chain Length: {len(chain)}")
        print("Chain Details:")
        for i, node in enumerate(chain, 1):
            print(f"  {i}. {node}")
    except:
        print("Could not parse chain_path")

print(f"\nCreated: {order.created_at}")
print(f"Updated: {order.updated_at}")

print("\n" + "="*70)
print("ANALYSIS")
print("="*70)

if not order.package_id:
    print("\n❌ PROBLEM: package_id is NULL!")
    print("   This means the order has no associated package.")
    print("   The frontend might filter out orders without packages.")
else:
    print(f"\n✅ Package ID exists: {order.package_id}")

if not order.package_name:
    print("\n⚠️ WARNING: package_name is NULL!")
    print("   Even if package_id exists, package_name should be set.")
else:
    print(f"\n✅ Package Name: {order.package_name}")

print("\n" + "="*70)
