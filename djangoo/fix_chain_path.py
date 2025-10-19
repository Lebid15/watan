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

# Fix chain_path for forwarded orders
print("=== FIXING CHAIN_PATH FOR FORWARDED ORDERS ===")
forwarded_orders = ProductOrder.objects.filter(external_order_id__startswith='stub-')
print(f"Found {forwarded_orders.count()} forwarded orders to fix")

for order in forwarded_orders:
    print(f"\nFixing order: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Current Chain Path: {order.chain_path}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"Tenant Name: {tenant.name}")
        
        # Set chain_path to "Forwarded" for forwarded orders
        chain_path = ["Forwarded"]
        order.chain_path = json.dumps(chain_path)
        order.save(update_fields=['chain_path'])
        print(f"SUCCESS: Chain path set to: {chain_path}")
        
    except Exception as e:
        print(f"ERROR: {e}")

print("\n=== VERIFICATION ===")
# Verify the fix
forwarded_orders = ProductOrder.objects.filter(external_order_id__startswith='stub-')
for order in forwarded_orders:
    print(f"Order ID: {order.id}")
    print(f"Chain Path: {order.chain_path}")
    if order.chain_path:
        try:
            chain_data = json.loads(order.chain_path)
            print(f"Chain Path Data: {chain_data}")
        except:
            print(f"Chain Path (raw): {order.chain_path}")
    print("---")
