#!/usr/bin/env python
"""
Check ShamTech routing configuration
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
print("CHECKING SHAMTECH ROUTING CONFIGURATION")
print("="*80)

# Get ShamTech tenant ID
shamtech_tenant_id = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"  # This is actually ShamTech tenant

print(f"ShamTech Tenant ID: {shamtech_tenant_id}")

# Check PackageRouting for ShamTech
print(f"\nPackageRouting for ShamTech:")
routings = PackageRouting.objects.filter(
    tenant_id=shamtech_tenant_id
)

if routings.exists():
    print(f"  Found {routings.count()} PackageRouting entries:")
    for routing in routings:
        print(f"    - Package ID: {routing.package_id}")
        print(f"    - Mode: {routing.mode}")
        print(f"    - Provider Type: {routing.provider_type}")
        print(f"    - Primary Provider: {routing.primary_provider_id}")
        
        if routing.primary_provider_id:
            provider = Integration.objects.filter(id=routing.primary_provider_id).first()
            if provider:
                print(f"      Provider Name: {provider.name}")
                print(f"      Provider Type: {provider.provider}")
        print()
else:
    print("  No PackageRouting found for ShamTech!")

# Check PackageMapping for ShamTech
print(f"\nPackageMapping for ShamTech:")
mappings = PackageMapping.objects.filter(
    tenant_id=shamtech_tenant_id
)

if mappings.exists():
    print(f"  Found {mappings.count()} PackageMapping entries:")
    for mapping in mappings:
        print(f"    - Our Package ID: {mapping.our_package_id}")
        print(f"    - Provider API ID: {mapping.provider_api_id}")
        print(f"    - Provider Package ID: {mapping.provider_package_id}")
        
        # Check if provider_api_id is ZNET
        if mapping.provider_api_id:
            provider = Integration.objects.filter(id=mapping.provider_api_id).first()
            if provider:
                print(f"      Provider Name: {provider.name}")
                print(f"      Provider Type: {provider.provider}")
        print()
else:
    print("  No PackageMapping found for ShamTech!")

# Check if ShamTech has ZNET integration
print(f"\nZNET Integration for ShamTech:")
znet_integrations = Integration.objects.filter(
    tenant_id=shamtech_tenant_id,
    provider='znet'
)

if znet_integrations.exists():
    print(f"  Found {znet_integrations.count()} ZNET integrations:")
    for integration in znet_integrations:
        print(f"    - ID: {integration.id}")
        print(f"    - Name: {integration.name}")
        print(f"    - Base URL: {integration.base_url}")
        print(f"    - Enabled: {integration.enabled}")
else:
    print("  No ZNET integration found for ShamTech!")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)