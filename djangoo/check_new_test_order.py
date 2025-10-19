#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Check the new test order
print("=== CHECKING NEW TEST ORDER ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order found: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Tenant ID: {order.tenant_id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    print(f"User: {order.user_identifier}")
    print(f"Price: {order.price}")
    print(f"Notes: {order.notes}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant: {tenant.name}")
    except Tenant.DoesNotExist:
        print(f"Tenant: Unknown")
        
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")




