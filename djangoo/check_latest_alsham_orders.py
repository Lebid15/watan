#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

print("=== Checking Latest Al-Sham Orders ===")

try:
    alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
    
    # Get the 5 most recent orders in Al-Sham
    orders = ProductOrder.objects.filter(tenant_id=alsham_tenant_id).order_by('-created_at')[:5]
    
    print(f"Found {orders.count()} recent orders in Al-Sham:")
    
    for i, order in enumerate(orders, 1):
        print(f"\n--- Order {i} ---")
        print(f"   - ID: {order.id}")
        print(f"   - External Order ID: {order.external_order_id}")
        print(f"   - Order No: {order.order_no}")
        print(f"   - Status: {order.status}")
        print(f"   - Mode: {order.mode}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Status: {order.external_status}")
        print(f"   - Chain Path: {order.chain_path}")
        print(f"   - Created At: {order.created_at}")
        
        # Check if this order was forwarded
        if order.mode == "CHAIN_FORWARD" and order.external_order_id and order.external_order_id.startswith('stub-'):
            print(f"   - [FORWARDED] This order was forwarded")
            target_order_id = order.external_order_id.replace('stub-', '')
            print(f"   - Target Order ID: {target_order_id}")
        else:
            print(f"   - [NOT FORWARDED] This order was not forwarded")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Check Complete ===")

