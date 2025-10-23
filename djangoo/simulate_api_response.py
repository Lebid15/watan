from apps.orders.models import ProductOrder
from django.core.serializers.json import DjangoJSONEncoder
import json

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("SIMULATING ADMIN API RESPONSE FOR SHAMTECH")
print("="*70)

# Get orders like the API does
orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')

print(f"\nTotal orders: {orders.count()}")

if orders.count() > 0:
    print("\nOrders that API would return:")
    print("-" * 70)
    
    for i, order in enumerate(orders[:10], 1):
        print(f"\n{i}. Order ID (last 6): {str(order.id)[-6:].upper()}")
        print(f"   Full ID: {order.id}")
        print(f"   User Identifier: {order.user_identifier}")
        print(f"   Status: {order.status}")
        print(f"   External Status: {order.external_status}")
        print(f"   Created: {order.created_at}")
        
        # Check if it has related data
        print(f"   Has Package: {order.package_id is not None}")
        print(f"   Has Product: {order.product_id is not None}")
        
else:
    print("\n❌ NO ORDERS FOUND IN SHAMTECH!")
    print("\nThis means the API would return an empty list.")
    print("Frontend would show: 'لا توجد طلبات مطابقة للفلاتر الحالية'")

print("\n" + "="*70)
print("CHECKING OUR SPECIFIC ORDER")
print("="*70)

our_order_id = '64827a9c-6782-4094-b73b-3f33c753242f'

try:
    our_order = ProductOrder.objects.get(id=our_order_id)
    
    print(f"\n✅ Order 53242F found!")
    print(f"   Tenant ID: {our_order.tenant_id}")
    print(f"   Match ShamTech: {str(our_order.tenant_id) == shamtech_tenant_id}")
    
    # Try to get package and product names
    from apps.packages.models import PackageModel
    from apps.products.models import ProductModel
    
    try:
        if our_order.package_id:
            package = PackageModel.objects.get(id=our_order.package_id)
            print(f"   Package: {package.name}")
    except:
        print(f"   Package: Not found (ID: {our_order.package_id})")
    
    try:
        if our_order.product_id:
            product = ProductModel.objects.get(id=our_order.product_id)
            print(f"   Product: {product.name}")
    except:
        print(f"   Product: Not found (ID: {our_order.product_id})")
        
except ProductOrder.DoesNotExist:
    print(f"\n❌ Order {our_order_id} NOT FOUND!")

print("\n" + "="*70)
