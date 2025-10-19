#!/usr/bin/env python
"""
Create a new test order to verify the fix
"""
import os
import sys
import django
import uuid
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import Product, ProductPackage
from apps.users.models import User
from apps.tenants.models import Tenant

print("="*80)
print("CREATING NEW TEST ORDER")
print("="*80)

# Get the tenant (fd0a6cce-f6e7-4c67-aa6c-a19fcac96536)
tenant_id = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"
tenant = Tenant.objects.get(id=tenant_id)
print(f"Tenant: {tenant.name}")

# Get the package (pubg global 325)
package_id = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"
package = ProductPackage.objects.get(id=package_id)
print(f"Package: {package.name}")

# Get the product
product = package.product
print(f"Product: {product.name}")

# Get a user
user = User.objects.filter(tenant_id=tenant_id).first()
if not user:
    print("ERROR: No user found for this tenant!")
    exit(1)
print(f"User: {user.username} (ID: {user.id})")

# Create new order
order_id = uuid.uuid4()
print(f"\nCreating new order: {order_id}")

new_order = ProductOrder.objects.create(
    id=order_id,
    tenant_id=tenant_id,
    user_id=user.id,
    product_id=product.id,
    package_id=package.id,
    quantity=1,
    status='pending',
    price=5.10,  # USD
    sell_price_currency='USD',
    sell_price_amount=5.10,
    created_at=timezone.now(),
    user_identifier='TEST123',
    extra_field='TEST123',
    notes=[],
    notes_count=0,
    mode='MANUAL'
)

print(f"Order created successfully!")
print(f"  ID: {new_order.id}")
print(f"  Status: {new_order.status}")
print(f"  User Identifier: {new_order.user_identifier}")
print(f"  Package: {new_order.package.name}")
print(f"  Tenant ID: {new_order.tenant_id}")
print(f"  Provider ID: {new_order.provider_id}")
print(f"  External Order ID: {new_order.external_order_id}")
print(f"  External Status: {new_order.external_status}")

# Test auto-dispatch
print(f"\nTesting auto-dispatch...")
from apps.orders.services import try_auto_dispatch_async

try:
    result = try_auto_dispatch_async(str(new_order.id), str(tenant_id))
    print(f"Auto-dispatch result: {result}")
    
    # Refresh order
    new_order.refresh_from_db()
    print(f"\nOrder after auto-dispatch:")
    print(f"  Provider ID: {new_order.provider_id}")
    print(f"  External Order ID: {new_order.external_order_id}")
    print(f"  External Status: {new_order.external_status}")
    print(f"  Status: {new_order.status}")
    
    if new_order.external_status == 'sent':
        print(f"SUCCESS: Order dispatched successfully!")
    elif new_order.external_status == 'processing':
        print(f"PARTIAL: Order sent but status is processing")
    else:
        print(f"FAILED: Order not dispatched properly")
        
except Exception as e:
    print(f"ERROR during auto-dispatch: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("TEST ORDER CREATION COMPLETE")
print("="*80)