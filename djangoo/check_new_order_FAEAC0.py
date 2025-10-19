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

# Find the new order FAEAC0
print("=== SEARCHING FOR NEW ORDER FAEAC0 ===")
try:
    # Try different search methods
    orders = ProductOrder.objects.filter(id__icontains='FAEAC0')
    if orders.exists():
        order = orders.first()
        print(f"Found order by ID contains: {order.id}")
    else:
        # Try searching by external_order_id
        orders = ProductOrder.objects.filter(external_order_id__icontains='FAEAC0')
        if orders.exists():
            order = orders.first()
            print(f"Found order by external_order_id: {order.id}")
        else:
            print("Order not found by any method")
            # Let's check recent orders
            print("\n=== RECENT ORDERS ===")
            recent_orders = ProductOrder.objects.order_by('-created_at')[:5]
            for order in recent_orders:
                print(f"Order ID: {order.id}")
                print(f"External Order ID: {order.external_order_id}")
                print(f"Created: {order.created_at}")
                print("---")
            sys.exit(1)
    
    print(f"\nOrder Details:")
    print(f"Order ID: {order.id}")
    print(f"Tenant ID: {order.tenant_id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Chain Path: {order.chain_path}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"Status: {order.status}")
    print(f"Created: {order.created_at}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant Name: {tenant.name}")
    except:
        print('Tenant not found')
        
    # Check if chain_path is JSON
    if order.chain_path:
        try:
            chain_data = json.loads(order.chain_path)
            print(f"Chain Path Data: {chain_data}")
        except:
            print(f"Chain Path (raw): {order.chain_path}")
    else:
        print('Chain Path is None or empty')
    
    # Check if this is a forwarded order
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print('This is a forwarded order (stub-)')
    else:
        print('This is NOT a forwarded order')
        
    # Check if this order was forwarded to another tenant
    if order.external_order_id and not order.external_order_id.startswith('stub-'):
        print(f'This order has external_order_id: {order.external_order_id}')
        print('This might be a forwarded order to external provider')
    
except Exception as e:
    print(f'Error: {e}')




