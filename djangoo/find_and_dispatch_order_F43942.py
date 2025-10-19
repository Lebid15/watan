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

# Find and dispatch order F43942
print("=== FINDING AND DISPATCHING ORDER F43942 ===")

# Find the order
try:
    # Try to find by external_order_id containing F43942
    order = ProductOrder.objects.get(external_order_id__icontains='F43942')
    print(f"Found order by external_order_id: {order.id}")
except ProductOrder.DoesNotExist:
    try:
        # Try to find by id containing F43942
        order = ProductOrder.objects.get(id__icontains='F43942')
        print(f"Found order by id: {order.id}")
    except ProductOrder.DoesNotExist:
        print("Order F43942 not found")
        exit(1)

print(f"\nOrder Details:")
print(f"  ID: {order.id}")
print(f"  External Order ID: {order.external_order_id}")
print(f"  Tenant ID: {order.tenant_id}")
print(f"  Status: {order.status}")
print(f"  Mode: {order.mode}")
print(f"  Provider ID: {order.provider_id}")
print(f"  Package: {order.package.name if order.package else 'Unknown'}")

# Get tenant name
try:
    tenant = Tenant.objects.get(id=order.tenant_id)
    print(f"  Tenant: {tenant.name}")
except Tenant.DoesNotExist:
    print(f"  Tenant: Unknown")

# Check if this is ShamTech tenant
if order.tenant_id == "7d677574-21be-45f7-b520-22e0fe36b860":
    print(f"  SUCCESS: This is ShamTech tenant (Diana)")
else:
    print(f"  ERROR: This is NOT ShamTech tenant")

# Check available providers
providers = Integration.objects.filter(tenant_id=order.tenant_id)
print(f"\nAvailable providers: {providers.count()}")
for provider in providers:
    print(f"  - {provider.name} ({provider.provider})")

# Find znet provider
znet_provider = providers.filter(provider='znet').first()
if not znet_provider:
    print("ERROR: No znet provider found")
    exit(1)

print(f"\nZnet provider: {znet_provider.name} ({znet_provider.id})")

# Check PackageRouting
try:
    routing = PackageRouting.objects.get(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    )
    print(f"SUCCESS: PackageRouting: {routing.mode} - {routing.provider_type}")
except PackageRouting.DoesNotExist:
    print("ERROR: No PackageRouting found")

# Check PackageMapping
try:
    mapping = PackageMapping.objects.get(
        tenant_id=order.tenant_id,
        our_package_id=order.package_id,
        provider_api_id=znet_provider.id
    )
    print(f"SUCCESS: PackageMapping: {mapping.provider_package_id}")
except PackageMapping.DoesNotExist:
    print("ERROR: No PackageMapping found")

# Try manual dispatch
print(f"\n=== ATTEMPTING MANUAL DISPATCH ===")
print(f"Order: {order.id}")
print(f"Provider: {znet_provider.name} ({znet_provider.id})")

# Simulate the admin panel dispatch
from apps.orders.services import try_auto_dispatch

try:
    print("Calling try_auto_dispatch...")
    try_auto_dispatch(str(order.id), str(order.tenant_id))
    
    # Check result
    order.refresh_from_db()
    print(f"\nResult:")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    
    if order.provider_id and order.external_order_id:
        print("SUCCESS: Dispatch completed!")
    else:
        print("ERROR: FAILED: No provider_id or external_order_id set")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    print("Full traceback:")
    print(traceback.format_exc())

print("\n=== COMPLETE ===")
