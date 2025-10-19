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

print("=== Checking Real Order B40999 ===")

try:
    # Find order by external_order_id containing B40999
    order = ProductOrder.objects.filter(external_order_id__icontains='B40999').first()
    
    if not order:
        # Try to find by order_no
        order = ProductOrder.objects.filter(order_no__icontains='B40999').first()
    
    if not order:
        print("[ERROR] Order B40999 not found")
        exit(1)
    
    print(f"[OK] Order found: {order.id}")
    print(f"   - External Order ID: {order.external_order_id}")
    print(f"   - Order No: {order.order_no}")
    print(f"   - Status: {order.status}")
    print(f"   - Mode: {order.mode}")
    print(f"   - Provider ID: {order.provider_id}")
    print(f"   - External Status: {order.external_status}")
    print(f"   - Chain Path: {order.chain_path}")
    print(f"   - Tenant ID: {order.tenant_id}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        print(f"   - Tenant: {tenant.name}")
    except Tenant.DoesNotExist:
        print(f"   - Tenant: Unknown")
    
    # Check if this is Al-Sham tenant
    if str(order.tenant_id) == "7d37f00a-22f3-4e61-88d7-2a97b79d86fb":
        print(f"[OK] This is Al-Sham tenant")
        
        # Check if order was forwarded
        if order.mode == "CHAIN_FORWARD" and order.external_order_id and order.external_order_id.startswith('stub-'):
            print(f"[OK] Order was forwarded")
            print(f"   - Forwarded to: {order.provider_id}")
            print(f"   - External Order ID: {order.external_order_id}")
            
            # Extract target order ID
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
            except ProductOrder.DoesNotExist:
                print(f"[ERROR] Target order not found in ShamTech!")
                print(f"   - Looking for ID: {target_order_id}")
                print(f"   - In tenant: {shamtech_tenant_id}")
        else:
            print(f"[WARNING] Order was NOT forwarded")
            print(f"   - Mode: {order.mode}")
            print(f"   - Provider ID: {order.provider_id}")
            print(f"   - External Order ID: {order.external_order_id}")
            
            # Check PackageRouting
            try:
                routing = PackageRouting.objects.get(
                    package_id=order.package_id,
                    tenant_id=order.tenant_id
                )
                print(f"[OK] PackageRouting exists:")
                print(f"   - Mode: {routing.mode}")
                print(f"   - Provider Type: {routing.provider_type}")
                print(f"   - Primary Provider: {routing.primary_provider_id}")
            except PackageRouting.DoesNotExist:
                print(f"[ERROR] No PackageRouting found!")
                print(f"   - Package ID: {order.package_id}")
                print(f"   - Tenant ID: {order.tenant_id}")
    else:
        print(f"[WARNING] This is NOT Al-Sham tenant")
        print(f"   - Tenant ID: {order.tenant_id}")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Check Complete ===")

