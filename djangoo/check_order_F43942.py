#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Check the specific order F43942
print("=== CHECKING ORDER F43942 ===")

# Find the order by external_order_id containing F43942
try:
    order = ProductOrder.objects.get(external_order_id__icontains='F43942')
    print(f"Found order: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Tenant ID: {order.tenant_id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Status: {order.external_status}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    print(f"User: {order.user_identifier}")
    print(f"Price: {order.price}")
    print(f"Created: {order.created_at}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant: {tenant.name}")
    except Tenant.DoesNotExist:
        print(f"Tenant: Unknown")
    
    # Check if this is the right tenant for ShamTech
    if order.tenant_id == "7d677574-21be-45f7-b520-22e0fe36b860":
        print("SUCCESS: This is ShamTech tenant")
    else:
        print(f"ERROR: This is NOT ShamTech tenant - it's {tenant.name}")
        
except ProductOrder.DoesNotExist:
    print("Order F43942 not found")

print("\n=== COMPLETE ===")




