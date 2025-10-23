#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Check Al-Sham order final status
print("=== CHECKING AL-SHAM ORDER FINAL STATUS ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Tenant ID: {order.tenant_id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"External Status: {order.external_status}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    print(f"User: {order.user_identifier}")
    print(f"Price: {order.price}")
    print(f"Chain Path: {order.chain_path}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant: {tenant.name}")
    except Tenant.DoesNotExist:
        print(f"Tenant: Unknown")
    
    # Check if this is forwarded
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print("SUCCESS: This order was forwarded to another tenant!")
        
    # Check chain_path
    if order.chain_path:
        import json
        try:
            chain_path = json.loads(order.chain_path)
            print(f"Chain Path: {chain_path}")
            if chain_path and len(chain_path) > 0:
                print(f"Next tenant: {chain_path[0]}")
        except:
            print(f"Chain Path (raw): {order.chain_path}")
    else:
        print("No chain path set")
        
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")







