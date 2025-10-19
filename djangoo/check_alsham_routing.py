#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping
from apps.products.models import ProductPackage
from apps.tenants.models import Tenant

# Check Al-Sham routing for pubg global 60
print("=== CHECKING AL-SHAM ROUTING ===")

alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

# Get pubg global 60 package
package = ProductPackage.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='pubg global 60'
).first()

if not package:
    print("pubg global 60 package not found")
    exit(1)

print(f"Package: {package.name} (ID: {package.id})")

# Check PackageRouting
routing = PackageRouting.objects.filter(
    tenant_id=alsham_tenant_id,
    package_id=package.id
).first()

if routing:
    print(f"Routing found:")
    print(f"  Mode: {routing.mode}")
    print(f"  Provider Type: {routing.provider_type}")
    
    # Check if this is external routing (should go to ShamTech)
    if routing.provider_type == 'external':
        print("  This is external routing - should go to ShamTech")
    else:
        print(f"  This is {routing.provider_type} routing")
else:
    print("No routing found for pubg global 60")

# Check PackageMapping
mapping = PackageMapping.objects.filter(
    tenant_id=alsham_tenant_id,
    our_package_id=package.id
).first()

if mapping:
    print(f"Mapping found:")
    print(f"  Our Package ID: {mapping.our_package_id}")
    print(f"  Provider Package ID: {mapping.provider_package_id}")
    print(f"  Provider API ID: {mapping.provider_api_id}")
else:
    print("No mapping found for pubg global 60")

print("\n=== COMPLETE ===")
