from apps.orders.models import ProductOrder

# Get the original order in alsham
order_alsham = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')

print(f"{'='*60}")
print(f"📦 ORDER IN ALSHAM (Source)")
print(f"{'='*60}")
print(f"Order ID: {order_alsham.id}")
print(f"Order No: {str(order_alsham.id)[-6:].upper()}")
print(f"Tenant ID: {order_alsham.tenant_id}")
print(f"Status: {order_alsham.status}")
print(f"External Status: {order_alsham.external_status}")
print(f"Provider ID: {order_alsham.provider_id}")
print(f"External Order ID: {order_alsham.external_order_id}")
print(f"Chain Path: {order_alsham.chain_path}")
print(f"Mode: {order_alsham.mode}")

# Check if there's a forwarded order in ShamTech
# The external_order_id in diana's system would be the same as this order's ID
print(f"\n{'='*60}")
print(f"🔍 SEARCHING FOR FORWARDED ORDER IN OTHER TENANTS")
print(f"{'='*60}")

# Look for orders that have this order's ID as external_order_id
forwarded_orders = ProductOrder.objects.filter(
    external_order_id=str(order_alsham.id)
).exclude(id=order_alsham.id)

if forwarded_orders.exists():
    print(f"✅ FOUND {forwarded_orders.count()} FORWARDED ORDER(S)!")
    for fo in forwarded_orders:
        print(f"\n  Order ID: {fo.id}")
        print(f"  Order No: {str(fo.id)[-6:].upper()}")
        print(f"  Tenant ID: {fo.tenant_id}")
        print(f"  Status: {fo.status}")
        print(f"  External Status: {fo.external_status}")
        print(f"  Provider ID: {fo.provider_id}")
        print(f"  External Order ID: {fo.external_order_id}")
        print(f"  Chain Path: {fo.chain_path}")
        print(f"  Mode: {fo.mode}")
else:
    print(f"❌ NO FORWARDED ORDERS FOUND!")
    print(f"   The order was NOT sent to diana/shamtech yet.")

# Also check for orders with stub- prefix
stub_orders = ProductOrder.objects.filter(
    external_order_id__startswith=f'stub-{order_alsham.id}'
)

if stub_orders.exists():
    print(f"\n{'='*60}")
    print(f"📌 FOUND STUB ORDERS (Intermediate forwarding)")
    print(f"{'='*60}")
    for so in stub_orders:
        print(f"\n  Order ID: {so.id}")
        print(f"  Tenant ID: {so.tenant_id}")
        print(f"  External Order ID: {so.external_order_id}")

print(f"\n{'='*60}")
