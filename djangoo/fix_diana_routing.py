#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Fix Diana routing and mapping
print("=== FIXING DIANA ROUTING AND MAPPING ===")

# Get Diana tenant
diana_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
diana_tenant = Tenant.objects.get(id=diana_tenant_id)
print(f"Diana tenant: {diana_tenant.name}")

# Get a package from Diana
order = ProductOrder.objects.filter(tenant_id=diana_tenant_id).first()
if not order:
    print("No orders found for Diana")
    exit(1)

package_id = order.package_id
print(f"Package ID: {package_id}")

# Get znet provider
znet_provider = Integration.objects.filter(
    tenant_id=diana_tenant_id,
    provider='znet'
).first()

if not znet_provider:
    print("No znet provider found for Diana")
    exit(1)

print(f"Znet provider: {znet_provider.name} ({znet_provider.id})")

# Create PackageRouting
print("\nCreating PackageRouting...")
import uuid
routing, created = PackageRouting.objects.get_or_create(
    package_id=package_id,
    tenant_id=diana_tenant_id,
    defaults={
        'id': uuid.uuid4(),
        'mode': 'auto',
        'provider_type': 'external',
        'primary_provider_id': znet_provider.id
    }
)

if created:
    print(f"Created PackageRouting: {routing.id}")
else:
    print(f"PackageRouting already exists: {routing.id}")

# Create PackageMapping
print("\nCreating PackageMapping...")
mapping, created = PackageMapping.objects.get_or_create(
    tenant_id=diana_tenant_id,
    our_package_id=package_id,
    provider_api_id=znet_provider.id,
    defaults={
        'id': uuid.uuid4(),
        'provider_package_id': 'pubg_global_60'  # Example external package ID
    }
)

if created:
    print(f"Created PackageMapping: {mapping.id}")
    print(f"Provider Package ID: {mapping.provider_package_id}")
else:
    print(f"PackageMapping already exists: {mapping.id}")

print("\n=== VERIFICATION ===")
# Verify setup
try:
    routing = PackageRouting.objects.get(
        package_id=package_id,
        tenant_id=diana_tenant_id
    )
    print(f"SUCCESS: PackageRouting: {routing.mode} - {routing.provider_type} - {routing.primary_provider_id}")
except PackageRouting.DoesNotExist:
    print("ERROR: PackageRouting not found")

try:
    mapping = PackageMapping.objects.get(
        tenant_id=diana_tenant_id,
        our_package_id=package_id,
        provider_api_id=znet_provider.id
    )
    print(f"SUCCESS: PackageMapping: {mapping.provider_package_id}")
except PackageMapping.DoesNotExist:
    print("ERROR: PackageMapping not found")

print("\n=== COMPLETE ===")
