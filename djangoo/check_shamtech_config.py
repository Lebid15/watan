#!/usr/bin/env python
"""
Check ShamTech configuration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping, Integration

print("="*80)
print("CHECKING SHAMTECH CONFIGURATION")
print("="*80)

# ShamTech tenant ID
shamtech_tenant_id = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"
package_id = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"

print(f"ShamTech Tenant ID: {shamtech_tenant_id}")
print(f"Package ID: {package_id}")

# Check PackageRouting for ShamTech
print(f"\nPackageRouting for ShamTech:")
routing = PackageRouting.objects.filter(
    package_id=package_id,
    tenant_id=shamtech_tenant_id
).first()

if routing:
    print(f"  Mode: {routing.mode}")
    print(f"  Provider Type: {routing.provider_type}")
    print(f"  Primary Provider ID: {routing.primary_provider_id}")
    
    if routing.primary_provider_id:
        provider = Integration.objects.filter(id=routing.primary_provider_id).first()
        if provider:
            print(f"  Provider Name: {provider.name}")
            print(f"  Provider Type: {provider.provider}")
else:
    print("  No PackageRouting found for ShamTech!")

# Check PackageMapping for ShamTech
print(f"\nPackageMapping for ShamTech:")
mapping = PackageMapping.objects.filter(
    our_package_id=package_id,
    tenant_id=shamtech_tenant_id
).first()

if mapping:
    print(f"  Provider Package ID: {mapping.provider_package_id}")
    print(f"  Provider API ID: {mapping.provider_api_id}")
    
    if mapping.provider_api_id:
        provider = Integration.objects.filter(id=mapping.provider_api_id).first()
        if provider:
            print(f"  Provider Name: {provider.name}")
            print(f"  Provider Type: {provider.provider}")
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



