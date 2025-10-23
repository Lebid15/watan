#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageMapping, Integration
from apps.products.models import ProductPackage
from apps.tenants.models import Tenant
import uuid

# Fix Al-Sham routing to point to ShamTech
print("=== FIXING AL-SHAM ROUTING ===")

alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get pubg global 60 package
package = ProductPackage.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='pubg global 60'
).first()

if not package:
    print("pubg global 60 package not found")
    exit(1)

print(f"Package: {package.name} (ID: {package.id})")

# Get ShamTech tenant
try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

# Get a provider in ShamTech
shamtech_provider = Integration.objects.filter(
    tenant_id=shamtech_tenant_id
).first()

if not shamtech_provider:
    print("No providers found in ShamTech")
    exit(1)

print(f"ShamTech provider: {shamtech_provider.name} (ID: {shamtech_provider.id})")

# Update PackageMapping to point to ShamTech provider
mapping = PackageMapping.objects.filter(
    tenant_id=alsham_tenant_id,
    our_package_id=package.id
).first()

if mapping:
    print(f"Updating existing mapping...")
    mapping.provider_api_id = shamtech_provider.id
    mapping.save()
    print(f"Updated mapping to point to ShamTech provider: {shamtech_provider.name}")
else:
    print("No mapping found to update")

print("\nSUCCESS: Al-Sham routing fixed to point to ShamTech!")

print("\n=== COMPLETE ===")







