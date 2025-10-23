from apps.orders.models import ProductOrder
from apps.tenancy.models import Tenant
from apps.products.models import Package

# Get ShamTech tenant
shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CHECKING SHAMTECH FRONTEND DATA")
print("="*70)

# Get ALL orders for ShamTech tenant
shamtech_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')

print(f"\nTotal orders in ShamTech: {shamtech_orders.count()}")
print("\nRecent orders:")
print("-" * 70)

for i, order in enumerate(shamtech_orders[:10], 1):
    try:
        package = Package.objects.get(id=order.package_id) if order.package_id else None
        package_name = package.name if package else 'N/A'
    except:
        package_name = 'N/A'
    
    print(f"\n{i}. Order: {str(order.id)[-6:].upper()}")
    print(f"   Full ID: {order.id}")
    print(f"   Package: {package_name}")
    print(f"   User ID: {order.user_identifier}")
    print(f"   Status: {order.status}")
    print(f"   External Status: {order.external_status}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   External Order ID: {order.external_order_id}")
    print(f"   Created: {order.created_at}")

# Check specifically for our new order
print("\n" + "="*70)
print("LOOKING FOR OUR SPECIFIC ORDER")
print("="*70)

our_order_id = 'c98ea6ff-a5ea-4945-8004-964089c51055'
try:
    our_order = ProductOrder.objects.get(id=our_order_id)
    print(f"\n✅ FOUND OUR ORDER!")
    print(f"Order ID: {our_order.id}")
    print(f"Order No (last 6): {str(our_order.id)[-6:].upper()}")
    print(f"Tenant ID: {our_order.tenant_id}")
    
    # Check if it matches ShamTech
    if str(our_order.tenant_id) == shamtech_tenant_id:
        print(f"✅ This order BELONGS TO SHAMTECH")
    else:
        print(f"❌ This order belongs to a DIFFERENT tenant!")
        print(f"   Expected: {shamtech_tenant_id}")
        print(f"   Actual: {our_order.tenant_id}")
    
    # Try to get package info
    try:
        pkg = Package.objects.get(id=our_order.package_id)
        print(f"\nPackage Info:")
        print(f"  Name: {pkg.name}")
        print(f"  ID: {pkg.id}")
    except Exception as e:
        print(f"\n⚠️ Cannot get package info: {e}")
        
except ProductOrder.DoesNotExist:
    print(f"\n❌ Order {our_order_id} NOT FOUND in database!")

print("\n" + "="*70)
