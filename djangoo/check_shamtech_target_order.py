#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

print("=== Checking ShamTech Target Order ===")

try:
    # The target order ID from the forwarded order
    target_order_id = "3f9afe4c-3c0e-44b6-981c-bbe338201c3b"
    shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
    
    print(f"Looking for target order: {target_order_id}")
    print(f"In ShamTech tenant: {shamtech_tenant_id}")
    
    # Check if target order exists in ShamTech
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
        
        # Get tenant name
        try:
            tenant = Tenant.objects.get(id=target_order.tenant_id)
            print(f"   - Tenant: {tenant.name}")
        except Tenant.DoesNotExist:
            print(f"   - Tenant: Unknown")
            
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

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Check Complete ===")

