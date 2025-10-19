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

print("=== Fixing ShamTech Order Dispatch ===")

# Find the ShamTech order that needs to be dispatched
try:
    shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
    
    # Get the most recent order in ShamTech
    order = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at').first()
    
    if not order:
        print("[ERROR] No orders found in ShamTech")
        exit(1)
    
    print(f"[OK] ShamTech order found: {order.id}")
    print(f"   - Status: {order.status}")
    print(f"   - Mode: {order.mode}")
    print(f"   - Provider ID: {order.provider_id}")
    print(f"   - External Order ID: {order.external_order_id}")
    print(f"   - External Status: {order.external_status}")
    
    # Check if this order needs to be dispatched
    if order.mode == "MANUAL" and not order.provider_id:
        print(f"\n=== Order needs dispatch ===")
        print(f"   - Mode: {order.mode}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - This order needs to be dispatched to final provider")
        
        # Check PackageRouting for this order
        try:
            routing = PackageRouting.objects.get(
                package_id=order.package_id,
                tenant_id=order.tenant_id
            )
            print(f"\n=== PackageRouting found ===")
            print(f"   - Mode: {routing.mode}")
            print(f"   - Provider Type: {routing.provider_type}")
            print(f"   - Primary Provider: {routing.primary_provider_id}")
            print(f"   - Fallback Provider: {routing.fallback_provider_id}")
            
            # Check if routing is set to auto
            if routing.mode == 'auto' and routing.provider_type == 'external':
                print(f"\n=== Attempting auto dispatch ===")
                try:
                    try_auto_dispatch(str(order.id), str(order.tenant_id))
                    
                    # Check result
                    order.refresh_from_db()
                    print(f"\nResult after dispatch attempt:")
                    print(f"   - Status: {order.status}")
                    print(f"   - Mode: {order.mode}")
                    print(f"   - Provider ID: {order.provider_id}")
                    print(f"   - External Order ID: {order.external_order_id}")
                    print(f"   - External Status: {order.external_status}")
                    
                    if order.provider_id and order.external_order_id and not order.external_order_id.startswith('stub-'):
                        print("[OK] Order successfully dispatched to final provider!")
                    else:
                        print("[WARNING] Order not dispatched to final provider")
                        
                except Exception as e:
                    print(f"[ERROR] Auto dispatch failed: {e}")
                    import traceback
                    print("Error details:")
                    print(traceback.format_exc())
            else:
                print(f"[WARNING] Routing not set to auto/external")
                print(f"   - Mode: {routing.mode}")
                print(f"   - Provider Type: {routing.provider_type}")
                
        except PackageRouting.DoesNotExist:
            print(f"[ERROR] No PackageRouting found for this package")
            print(f"   - Package ID: {order.package_id}")
            print(f"   - Tenant ID: {order.tenant_id}")
            
            # List available packages and routing
            print(f"\n=== Available PackageRouting in ShamTech ===")
            routings = PackageRouting.objects.filter(tenant_id=shamtech_tenant_id)
            print(f"Found {routings.count()} routing configurations:")
            for routing in routings:
                print(f"   - Package: {routing.package_id} (Mode: {routing.mode}, Type: {routing.provider_type})")
    
    else:
        print(f"\n=== Order already processed ===")
        print(f"   - Mode: {order.mode}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        print(f"   - This order has already been processed")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Fix Complete ===")

