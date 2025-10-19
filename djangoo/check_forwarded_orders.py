#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant
import json

# Find forwarded orders (stub-)
print("=== FORWARDED ORDERS (stub-) ===")
forwarded_orders = ProductOrder.objects.filter(external_order_id__startswith='stub-')
print(f"Found {forwarded_orders.count()} forwarded orders")

for order in forwarded_orders[:5]:  # Show first 5
    print(f"\nOrder ID: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Chain Path: {order.chain_path}")
    print(f"Mode: {order.mode}")
    print(f"Status: {order.status}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant Name: {tenant.name}")
    except:
        print('Tenant not found')

print("\n=== RECENT ORDERS ===")
recent_orders = ProductOrder.objects.order_by('-created_at')[:10]
for order in recent_orders:
    print(f"Order ID: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Chain Path: {order.chain_path}")
    print(f"Mode: {order.mode}")
    print(f"Status: {order.status}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant Name: {tenant.name}")
    except:
        print('Tenant not found')
    print("---")




