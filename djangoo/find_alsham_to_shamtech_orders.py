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

# Find Al-Sham orders that were forwarded to ShamTech
print("=== FINDING AL-SHAM ORDERS FORWARDED TO SHAMTECH ===")

# Get Al-Sham tenant
try:
    alsham_tenant = Tenant.objects.get(name='Al-Sham')
    print(f"Al-Sham Tenant ID: {alsham_tenant.id}")
except:
    print("Al-Sham tenant not found")
    sys.exit(1)

# Find recent Al-Sham orders
print(f"\n=== RECENT AL-SHAM ORDERS ===")
alsham_orders = ProductOrder.objects.filter(tenant_id=alsham_tenant.id).order_by('-created_at')[:10]

for order in alsham_orders:
    print(f"\nOrder ID: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Chain Path: {order.chain_path}")
    print(f"Mode: {order.mode}")
    print(f"Status: {order.status}")
    print(f"Created: {order.created_at}")
    
    # Check if this is a forwarded order
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print(">>> This is a FORWARDED order (stub-)")
    elif order.external_order_id:
        print(f">>> This has external_order_id: {order.external_order_id}")
    else:
        print(">>> This has no external_order_id")

# Find ShamTech orders that might be the result of forwarding
print(f"\n=== SHAMTECH ORDERS (FORWARDED FROM AL-SHAM) ===")
try:
    shamtech_tenant = Tenant.objects.get(name='ShamTech')
    print(f"ShamTech Tenant ID: {shamtech_tenant.id}")
    
    shamtech_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant.id).order_by('-created_at')[:5]
    for order in shamtech_orders:
        print(f"\nShamTech Order ID: {order.id}")
        print(f"External Order ID: {order.external_order_id}")
        print(f"Chain Path: {order.chain_path}")
        print(f"Mode: {order.mode}")
        print(f"Status: {order.status}")
        print(f"Created: {order.created_at}")
        
except:
    print("ShamTech tenant not found")

print(f"\n=== ALL FORWARDED ORDERS (stub-) ===")
forwarded_orders = ProductOrder.objects.filter(external_order_id__startswith='stub-')
print(f"Found {forwarded_orders.count()} forwarded orders")

for order in forwarded_orders:
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"\nOrder ID: {order.id}")
        print(f"Tenant: {tenant.name}")
        print(f"External Order ID: {order.external_order_id}")
        print(f"Chain Path: {order.chain_path}")
        print(f"Mode: {order.mode}")
        print(f"Status: {order.status}")
    except:
        print(f"Order ID: {order.id} (tenant not found)")




