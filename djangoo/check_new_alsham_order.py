#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting, PackageMapping
from apps.tenants.models import Tenant
from apps.orders.services import try_auto_dispatch
import json

print("=== Checking New Al-Sham Order ===")

# Find the most recent order in Al-Sham
try:
    alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
    
    # Get the most recent order
    order = ProductOrder.objects.filter(tenant_id=alsham_tenant_id).order_by('-created_at').first()
    
    if not order:
        print("[ERROR] No orders found in Al-Sham")
        exit(1)
    
    print(f"[OK] Most recent order found: {order.id}")
    print(f"   - External Order ID: {order.external_order_id}")
    print(f"   - Status: {order.status}")
    print(f"   - Mode: {order.mode}")
    print(f"   - Provider ID: {order.provider_id}")
    print(f"   - External Status: {order.external_status}")
    print(f"   - Chain Path: {order.chain_path}")
    print(f"   - Created At: {order.created_at}")
    
    # Check if this order was forwarded
    if order.mode == "CHAIN_FORWARD" and order.external_order_id and order.external_order_id.startswith('stub-'):
        print(f"\n=== Chain Forward Analysis ===")
        print(f"[OK] Order was forwarded")
        print(f"   - Forwarded to: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        
        # Extract the target order ID from stub
        target_order_id = order.external_order_id.replace('stub-', '')
        print(f"   - Target Order ID: {target_order_id}")
        
        # Check if target order exists in ShamTech
        shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
        try:
            target_order = ProductOrder.objects.get(id=target_order_id, tenant_id=shamtech_tenant_id)
            print(f"[OK] Target order found in ShamTech:")
            print(f"   - ID: {target_order.id}")
            print(f"   - Status: {target_order.status}")
            print(f"   - Mode: {target_order.mode}")
            print(f"   - Provider ID: {target_order.provider_id}")
            print(f"   - External Order ID: {target_order.external_order_id}")
            print(f"   - External Status: {target_order.external_status}")
            print(f"   - Created At: {target_order.created_at}")
            
            # Check if target order was sent to final provider
            if target_order.provider_id and target_order.external_order_id and not target_order.external_order_id.startswith('stub-'):
                print(f"[OK] Target order was sent to final provider!")
                print(f"   - Provider: {target_order.provider_id}")
                print(f"   - External Order ID: {target_order.external_order_id}")
            else:
                print(f"[WARNING] Target order not sent to final provider yet")
                print(f"   - Provider ID: {target_order.provider_id}")
                print(f"   - External Order ID: {target_order.external_order_id}")
                
        except ProductOrder.DoesNotExist:
            print(f"[ERROR] Target order not found in ShamTech!")
            print(f"   - Looking for ID: {target_order_id}")
            print(f"   - In tenant: {shamtech_tenant_id}")
            
            # List recent orders in ShamTech
            print(f"\n=== Recent Orders in ShamTech ===")
            recent_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')[:5]
            print(f"Found {recent_orders.count()} recent orders:")
            for recent_order in recent_orders:
                print(f"   - {recent_order.id} (Status: {recent_order.status}, Created: {recent_order.created_at})")
    
    else:
        print(f"\n=== Order Not Forwarded ===")
        print(f"   - Mode: {order.mode}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        print(f"   - This order was not automatically forwarded")
        
        # Try to manually forward it
        print(f"\n=== Attempting Manual Forward ===")
        try:
            try_auto_dispatch(str(order.id), str(order.tenant_id))
            order.refresh_from_db()
            print(f"Result after manual attempt:")
            print(f"   - Mode: {order.mode}")
            print(f"   - Provider ID: {order.provider_id}")
            print(f"   - External Order ID: {order.external_order_id}")
        except Exception as e:
            print(f"[ERROR] Manual forward failed: {e}")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Check Complete ===")

