#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration
from apps.tenants.models import Tenant

# Check how to forward from Al-Sham to ShamTech
print("=== CHECKING AL-SHAM TO SHAMTECH FORWARDING ===")

# Get the F43942 order in Al-Sham
order = ProductOrder.objects.get(external_order_id__icontains='F43942')
print(f"Order F43942: {order.id}")
print(f"Tenant: {order.tenant_id} (Al-Sham)")
print(f"Status: {order.status}")
print(f"Mode: {order.mode}")
print(f"Provider ID: {order.provider_id}")

# Check if this order should be forwarded to ShamTech
# The provider_id 71544f6c-705e-4e7f-bc3c-c24dc90428b7 should be ShamTech
shamtech_provider = Integration.objects.filter(
    id=order.provider_id
).first()

if shamtech_provider:
    print(f"Provider: {shamtech_provider.name} ({shamtech_provider.provider})")
    print(f"Provider Tenant: {shamtech_provider.tenant_id}")
    
    # Check if this provider belongs to ShamTech tenant
    shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
    if str(shamtech_provider.tenant_id) == shamtech_tenant_id:
        print("SUCCESS: This provider belongs to ShamTech tenant")
        print("The order should be forwarded to ShamTech")
    else:
        print(f"ERROR: This provider belongs to different tenant: {shamtech_provider.tenant_id}")
else:
    print("ERROR: Provider not found")

print("\n=== COMPLETE ===")







