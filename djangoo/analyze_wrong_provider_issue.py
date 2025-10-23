#!/usr/bin/env python
"""
Analyze wrong provider issue for order 7CD078
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration

print("="*80)
print("ANALYZING WRONG PROVIDER ISSUE")
print("="*80)

# Get the order
order_id = "38cf33ef-6ad2-4203-baec-420aaf7cd078"
order = ProductOrder.objects.get(id=order_id)

print(f"Order: {order.id}")
print(f"Tenant ID: {order.tenant_id}")
print(f"Package ID: {order.package_id}")

# Check PackageRouting
print(f"\nPackageRouting Configuration:")
routing = PackageRouting.objects.get(
    package_id=order.package_id,
    tenant_id=order.tenant_id
)

print(f"  Mode: {routing.mode}")
print(f"  Provider Type: {routing.provider_type}")
print(f"  Primary Provider ID: {routing.primary_provider_id}")

# Check the primary provider
primary_provider = Integration.objects.get(id=routing.primary_provider_id)
print(f"\nPrimary Provider (from routing):")
print(f"  ID: {primary_provider.id}")
print(f"  Name: {primary_provider.name}")
print(f"  Provider: {primary_provider.provider}")
print(f"  Base URL: {primary_provider.base_url}")

# Check the actual provider used
actual_provider = Integration.objects.get(id=order.provider_id)
print(f"\nActual Provider (used in order):")
print(f"  ID: {actual_provider.id}")
print(f"  Name: {actual_provider.name}")
print(f"  Provider: {actual_provider.provider}")
print(f"  Base URL: {actual_provider.base_url}")

# Check if they are different
if routing.primary_provider_id != order.provider_id:
    print(f"\n❌ MISMATCH DETECTED!")
    print(f"  Routing says: {routing.primary_provider_id} ({primary_provider.name})")
    print(f"  Order uses: {order.provider_id} ({actual_provider.name})")
    print(f"  This is the problem!")
else:
    print(f"\n✅ Providers match correctly")

# Check PackageMapping for both providers
print(f"\nPackageMapping for Primary Provider:")
mapping_primary = PackageMapping.objects.filter(
    our_package_id=order.package_id,
    tenant_id=order.tenant_id,
    provider_api_id=routing.primary_provider_id
).first()

if mapping_primary:
    print(f"  Provider Package ID: {mapping_primary.provider_package_id}")
else:
    print("  No mapping found for primary provider!")

print(f"\nPackageMapping for Actual Provider:")
mapping_actual = PackageMapping.objects.filter(
    our_package_id=order.package_id,
    tenant_id=order.tenant_id,
    provider_api_id=order.provider_id
).first()

if mapping_actual:
    print(f"  Provider Package ID: {mapping_actual.provider_package_id}")
else:
    print("  No mapping found for actual provider!")

print("\n" + "="*80)
print("ANALYSIS COMPLETE")
print("="*80)



