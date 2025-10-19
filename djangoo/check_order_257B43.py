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

# Find the order - try different approaches
order = None
try:
    # First try as UUID
    order = ProductOrder.objects.get(id='257B43')
    print('Found order by exact ID')
except:
    try:
        # Try searching by external_order_id or other fields
        orders = ProductOrder.objects.filter(external_order_id__icontains='257B43')
        if orders.exists():
            order = orders.first()
            print(f'Found order by external_order_id: {order.id}')
        else:
            # Try searching by any field containing 257B43
            orders = ProductOrder.objects.filter(id__icontains='257B43')
            if orders.exists():
                order = orders.first()
                print(f'Found order by id contains: {order.id}')
            else:
                raise ProductOrder.DoesNotExist()
    except:
        print('Order not found by any method')
        sys.exit(1)

if order:
    print(f'Order found: {order.id}')
    print(f'Tenant ID: {order.tenant_id}')
    print(f'External Order ID: {order.external_order_id}')
    print(f'Chain Path: {order.chain_path}')
    print(f'Mode: {order.mode}')
    print(f'Provider ID: {order.provider_id}')
    print(f'Status: {order.status}')
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f'Tenant Name: {tenant.name}')
    except:
        print('Tenant not found')
        
    # Check if chain_path is JSON
    if order.chain_path:
        try:
            chain_data = json.loads(order.chain_path)
            print(f'Chain Path Data: {chain_data}')
        except:
            print(f'Chain Path (raw): {order.chain_path}')
    else:
        print('Chain Path is None or empty')
    
    # Check if this is a forwarded order
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print('This is a forwarded order (stub-)')
    else:
        print('This is NOT a forwarded order')
