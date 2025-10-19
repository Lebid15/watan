#!/usr/bin/env python
"""
Comprehensive diagnosis of ShamTech auto-dispatch issue to ZNET
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.products.models import ProductPackage
from apps.tenants.models import Tenant

print("="*80)
print("COMPREHENSIVE DIAGNOSIS: ShamTech Auto-Dispatch to ZNET")
print("="*80)

# Tenant IDs
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"  # ShamTech

print(f"\nShamTech Information:")
print(f"   Tenant ID: {shamtech_tenant_id}")

# 1. Check pending orders in ShamTech
print(f"\n1. Checking pending orders in ShamTech:")
pending_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending'
).order_by('-created_at')[:5]

if pending_orders.exists():
    print(f"   Found {pending_orders.count()} pending orders")
    for order in pending_orders:
        print(f"   - {str(order.id)[:8]}... | {order.package.name if order.package else 'Unknown'} | {order.user_identifier}")
else:
    print(f"   No pending orders found")

# 2. Check ZNET providers in ShamTech
print(f"\n2. Checking ZNET providers in ShamTech:")
znet_providers = Integration.objects.filter(
    tenant_id=shamtech_tenant_id,
    provider='znet'
)

if znet_providers.exists():
    print(f"   Found {znet_providers.count()} ZNET providers")
    for provider in znet_providers:
        print(f"   - {provider.name} (ID: {provider.id})")
        print(f"     Base URL: {provider.base_url}")
        print(f"     Active: {getattr(provider, 'active', 'Unknown')}")
else:
    print(f"   No ZNET providers found")

# 3. Check PackageRouting settings
print(f"\n3. Checking PackageRouting settings:")
routings = PackageRouting.objects.filter(
    tenant_id=shamtech_tenant_id,
    mode='auto',
    provider_type='external'
)

if routings.exists():
    print(f"   Found {routings.count()} auto external routing configurations")
    for routing in routings:
        print(f"   - Package ID: {routing.package_id}")
        print(f"     Mode: {routing.mode}")
        print(f"     Provider Type: {routing.provider_type}")
        print(f"     Primary Provider: {routing.primary_provider_id}")
        
        # Check primary provider
        if routing.primary_provider_id:
            provider = Integration.objects.filter(id=routing.primary_provider_id).first()
            if provider:
                print(f"     Provider Name: {provider.name}")
                print(f"     Provider Type: {provider.provider}")
            else:
                print(f"     Primary provider not found!")
else:
    print(f"   No auto external routing configurations found")

# 4. Check PackageMapping
print(f"\n4. Checking PackageMapping:")
mappings = PackageMapping.objects.filter(
    tenant_id=shamtech_tenant_id
)

if mappings.exists():
    print(f"   Found {mappings.count()} mappings")
    for mapping in mappings:
        print(f"   - Our Package: {mapping.our_package_id}")
        print(f"     Provider API: {mapping.provider_api_id}")
        print(f"     Provider Package: {mapping.provider_package_id}")
else:
    print(f"   No mappings found")

# 5. Check forwarded orders (stub-)
print(f"\n5. Checking forwarded orders (stub-):")
stub_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    external_order_id__startswith='stub-'
).order_by('-created_at')[:3]

if stub_orders.exists():
    print(f"   Found {stub_orders.count()} forwarded orders")
    for order in stub_orders:
        print(f"   - {str(order.id)[:8]}... | Status: {order.status}")
        print(f"     External Order ID: {order.external_order_id}")
        print(f"     Provider ID: {order.provider_id}")
        print(f"     Mode: {order.mode}")
else:
    print(f"   No forwarded orders found")

# 6. Check orders sent to ZNET
print(f"\n6. Checking orders sent to ZNET:")
znet_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    external_order_id__startswith='znet-'
).order_by('-created_at')[:3]

if znet_orders.exists():
    print(f"   Found {znet_orders.count()} orders sent to ZNET")
    for order in znet_orders:
        print(f"   - {str(order.id)[:8]}... | Status: {order.status}")
        print(f"     External Order ID: {order.external_order_id}")
        print(f"     Provider ID: {order.provider_id}")
else:
    print(f"   No orders sent to ZNET found")

# 7. Check failed dispatch orders
print(f"\n7. Checking failed dispatch orders:")
failed_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending',
    provider_id__isnull=False,
    external_order_id__isnull=True
).order_by('-created_at')[:3]

if failed_orders.exists():
    print(f"   Found {failed_orders.count()} failed dispatch orders")
    for order in failed_orders:
        print(f"   - {str(order.id)[:8]}... | Provider: {order.provider_id}")
        print(f"     Status: {order.status}")
        print(f"     External Status: {order.external_status}")
else:
    print(f"   No failed dispatch orders found")

print("\n" + "="*80)
print("DIAGNOSIS COMPLETE")
print("="*80)
