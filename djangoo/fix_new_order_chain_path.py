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

# Fix chain_path for the new order FAEAC0
order_id = 'f6abf117-e6ae-4c27-9f7e-83a60bfaeac0'
try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order found: {order.id}")
    print(f"Current Chain Path: {order.chain_path}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant Name: {tenant.name}")
    except:
        print('Tenant not found')
    
    # Since this order has a provider_id, it was forwarded to an external provider
    # We need to determine what provider this is
    if order.provider_id:
        print(f"\nThis order was forwarded to provider: {order.provider_id}")
        
        # For now, let's set chain_path to indicate forwarding
        chain_path = ["Forwarded"]
        order.chain_path = json.dumps(chain_path)
        order.save(update_fields=['chain_path'])
        print(f"SUCCESS: Chain path set to: {chain_path}")
        
        # Verify the fix
        order.refresh_from_db()
        print(f"Updated Chain Path: {order.chain_path}")
        
        if order.chain_path:
            try:
                chain_data = json.loads(order.chain_path)
                print(f"Chain Path Data: {chain_data}")
            except:
                print(f"Chain Path (raw): {order.chain_path}")
    
except ProductOrder.DoesNotExist:
    print('Order not found')
except Exception as e:
    print(f'Error: {e}')







