#!/usr/bin/env python
"""
Check PackageRouting configuration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping, Integration

print("="*80)
print("CHECKING PACKAGE ROUTING CONFIGURATION")
print("="*80)

# Package ID for pubg global 325
package_id = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"

# Get all PackageRouting for this package
routings = PackageRouting.objects.filter(package_id=package_id)

print(f"\nAll PackageRouting for package {package_id}:")
print(f"Found {routings.count()} routings")

for routing in routings:
    print(f"\n  Routing ID: {routing.id}")
    print(f"  Tenant ID: {routing.tenant_id}")
    print(f"  Mode: {routing.mode}")
    print(f"  Provider Type: {routing.provider_type}")
    print(f"  Primary Provider ID: {routing.primary_provider_id}")
    
    if routing.primary_provider_id:
        provider = Integration.objects.filter(id=routing.primary_provider_id).first()
        if provider:
            print(f"  Provider Name: {provider.name}")
            print(f"  Provider Type: {provider.provider}")
            print(f"  Provider Tenant ID: {provider.tenant_id}")
            
            # Check if provider is diana
            if provider.name == 'diana':
                print(f"  WARNING: This routing uses diana!")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
