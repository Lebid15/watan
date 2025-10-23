#!/usr/bin/env python
"""
Script to check PackageRouting primary_provider_id for khalil user's orders
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping
from apps.products.models import ProductPackage
from apps.providers.models import Integration

print("\n" + "=" * 80)
print("CHECKING PACKAGEROUTING FOR KHALIL USER")
print("=" * 80)

# Find khalil's package (PUBG 660 UC)
pubg_packages = ProductPackage.objects.filter(
    name__icontains='660',
    product__name__icontains='PUBG'
).select_related('product')

print(f"\nFound {pubg_packages.count()} packages matching 'PUBG 660':")
for pkg in pubg_packages:
    print(f"\nPackage: {pkg.name} (ID: {pkg.id})")
    print(f"   Product: {pkg.product.name}")
    print(f"   Tenant ID: {pkg.tenant_id}")
    
    # Get routing for this package
    routings = PackageRouting.objects.filter(package_id=pkg.id)
    print(f"   Routings: {routings.count()}")
    
    for routing in routings:
        print(f"\n   Routing ID: {routing.id}")
        print(f"   Mode: {routing.mode}")
        print(f"   Provider Type: {routing.provider_type}")
        print(f"   Primary Provider ID: {routing.primary_provider_id}")
        print(f"   Fallback Provider ID: {routing.fallback_provider_id}")
        print(f"   Code Group ID: {routing.code_group_id}")
        
        # Look up the Integration
        if routing.primary_provider_id:
            try:
                integration = Integration.objects.get(id=routing.primary_provider_id)
                print(f"\n   Primary Provider Details:")
                print(f"      Name: {integration.name}")
                print(f"      Provider: {integration.provider}")
                print(f"      Tenant ID: {integration.tenant_id}")
                
                # Check if this is the wrong provider (alayaZnet)
                if integration.id == '6d8790a9-9930-4543-80aa-b0b92aa16404':
                    print(f"      ⚠️  WARNING: This is alayaZnet (WRONG PROVIDER!)")
                elif str(integration.id) == '71544f6c-705e-4e7f-bc3c-c24dc90428b7':
                    print(f"      ✅ This is diana (CORRECT PROVIDER)")
                else:
                    print(f"      ℹ️  Unknown provider")
                    
            except Integration.DoesNotExist:
                print(f"   ⚠️  PRIMARY PROVIDER NOT FOUND!")
        
        if routing.fallback_provider_id:
            try:
                fallback = Integration.objects.get(id=routing.fallback_provider_id)
                print(f"\n   Fallback Provider Details:")
                print(f"      Name: {fallback.name}")
                print(f"      Provider: {fallback.provider}")
                print(f"      Tenant ID: {fallback.tenant_id}")
            except Integration.DoesNotExist:
                print(f"   ⚠️  FALLBACK PROVIDER NOT FOUND!")

print("\n" + "=" * 80)
print("DONE")
print("=" * 80 + "\n")
