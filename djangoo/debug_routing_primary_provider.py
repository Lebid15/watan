#!/usr/bin/env python
"""
Debug routing primary provider
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, Integration

print("="*80)
print("DEBUGGING ROUTING PRIMARY PROVIDER")
print("="*80)

# Package ID for pubg global 325
package_id = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"

# Tenant ID (admin1)
tenant_id = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"

# Get PackageRouting
routing = PackageRouting.objects.filter(
    package_id=package_id,
    tenant_id=tenant_id
).first()

if routing:
    print(f"\nPackageRouting found:")
    print(f"  ID: {routing.id}")
    print(f"  Tenant ID: {routing.tenant_id}")
    print(f"  Package ID: {routing.package_id}")
    print(f"  Mode: {routing.mode}")
    print(f"  Provider Type: {routing.provider_type}")
    print(f"  Primary Provider ID: {routing.primary_provider_id}")
    print(f"  Primary Provider ID type: {type(routing.primary_provider_id)}")
    
    # Get the provider
    if routing.primary_provider_id:
        provider = Integration.objects.filter(id=routing.primary_provider_id).first()
        if provider:
            print(f"\n  Provider found:")
            print(f"    ID: {provider.id}")
            print(f"    Name: {provider.name}")
            print(f"    Provider: {provider.provider}")
            print(f"    Tenant ID: {provider.tenant_id}")
        else:
            print(f"\n  ERROR: Provider not found with ID: {routing.primary_provider_id}")
    else:
        print(f"\n  ERROR: Primary Provider ID is None!")
else:
    print(f"\nERROR: PackageRouting not found!")
    print(f"  Package ID: {package_id}")
    print(f"  Tenant ID: {tenant_id}")

print("\n" + "="*80)
print("DEBUG COMPLETE")
print("="*80)
