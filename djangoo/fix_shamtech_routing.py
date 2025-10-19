#!/usr/bin/env python
"""
Fix ShamTech routing configuration
"""
import os
import sys
import django
import uuid

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping, Integration

print("="*80)
print("FIXING SHAMTECH ROUTING CONFIGURATION")
print("="*80)

# ShamTech tenant ID
shamtech_tenant_id = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"

# Package ID for pubg global 325
package_id = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"

# ZNET integration ID
znet_integration_id = "6d8790a9-9930-4543-80aa-b0b92aa16404"

print(f"ShamTech Tenant ID: {shamtech_tenant_id}")
print(f"Package ID: {package_id}")
print(f"ZNET Integration ID: {znet_integration_id}")

# Check if ZNET integration exists
znet_integration = Integration.objects.filter(id=znet_integration_id).first()
if not znet_integration:
    print("ERROR: ZNET integration not found!")
    exit(1)

print(f"ZNET Integration: {znet_integration.name}")

# Create PackageRouting for ShamTech
print(f"\nCreating PackageRouting for ShamTech...")
routing, created = PackageRouting.objects.get_or_create(
    package_id=package_id,
    tenant_id=shamtech_tenant_id,
    defaults={
        'id': uuid.uuid4(),
        'mode': 'auto',
        'provider_type': 'external',
        'primary_provider_id': znet_integration_id,
        'fallback_provider_id': None,
        'code_group_id': None
    }
)

if created:
    print(f"  Created new PackageRouting: {routing.id}")
else:
    print(f"  Updated existing PackageRouting: {routing.id}")

print(f"  Mode: {routing.mode}")
print(f"  Provider Type: {routing.provider_type}")
print(f"  Primary Provider: {routing.primary_provider_id}")

# Create PackageMapping for ShamTech
print(f"\nCreating PackageMapping for ShamTech...")
mapping, created = PackageMapping.objects.get_or_create(
    our_package_id=package_id,
    tenant_id=shamtech_tenant_id,
    provider_api_id=znet_integration_id,
    defaults={
        'id': uuid.uuid4(),
        'provider_package_id': '263'  # ZNET package ID
    }
)

if created:
    print(f"  Created new PackageMapping: {mapping.id}")
else:
    print(f"  Updated existing PackageMapping: {mapping.id}")

print(f"  Our Package ID: {mapping.our_package_id}")
print(f"  Provider API ID: {mapping.provider_api_id}")
print(f"  Provider Package ID: {mapping.provider_package_id}")

print(f"\n" + "="*80)
print("SHAMTECH ROUTING CONFIGURATION COMPLETE")
print("="*80)
