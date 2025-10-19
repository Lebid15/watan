#!/usr/bin/env python
"""
Create ZNET integration for ShamTech
"""
import os
import sys
import django
import uuid

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from django.utils import timezone

print("="*80)
print("CREATING ZNET INTEGRATION FOR SHAMTECH")
print("="*80)

# ShamTech tenant ID
shamtech_tenant_id = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"

# Get the existing ZNET integration details
znet_integration = Integration.objects.filter(
    id="6d8790a9-9930-4543-80aa-b0b92aa16404"
).first()

if not znet_integration:
    print("ERROR: ZNET integration not found!")
    exit(1)

print(f"ZNET Integration: {znet_integration.name}")
print(f"Base URL: {znet_integration.base_url}")
print(f"Kod: {znet_integration.kod}")
print(f"Sifre: {znet_integration.sifre}")

# Create ZNET integration for ShamTech
print(f"\nCreating ZNET integration for ShamTech...")
shamtech_znet, created = Integration.objects.get_or_create(
    tenant_id=shamtech_tenant_id,
    provider='znet',
    defaults={
        'id': uuid.uuid4(),
        'name': 'alayaZnet',
        'scope': 'tenant',
        'base_url': znet_integration.base_url,
        'api_token': znet_integration.api_token,
        'kod': znet_integration.kod,
        'sifre': znet_integration.sifre,
        'enabled': True,
        'balance': znet_integration.balance,
        'balance_updated_at': znet_integration.balance_updated_at,
        'created_at': timezone.now()
    }
)

if created:
    print(f"  Created new ZNET integration for ShamTech: {shamtech_znet.id}")
else:
    print(f"  Updated existing ZNET integration for ShamTech: {shamtech_znet.id}")

print(f"  Name: {shamtech_znet.name}")
print(f"  Provider: {shamtech_znet.provider}")
print(f"  Base URL: {shamtech_znet.base_url}")
print(f"  Enabled: {shamtech_znet.enabled}")

# Update PackageRouting to use the new integration
print(f"\nUpdating PackageRouting to use new integration...")
from apps.providers.models import PackageRouting

routing = PackageRouting.objects.filter(
    package_id="4b827947-95b3-4ac9-9bfd-a8b3d6dbb095",
    tenant_id=shamtech_tenant_id
).first()

if routing:
    routing.primary_provider_id = shamtech_znet.id
    routing.save()
    print(f"  Updated PackageRouting to use new integration: {shamtech_znet.id}")
else:
    print("  No PackageRouting found for ShamTech!")

# Update PackageMapping to use the new integration
print(f"\nUpdating PackageMapping to use new integration...")
from apps.providers.models import PackageMapping

mapping = PackageMapping.objects.filter(
    our_package_id="4b827947-95b3-4ac9-9bfd-a8b3d6dbb095",
    tenant_id=shamtech_tenant_id
).first()

if mapping:
    mapping.provider_api_id = shamtech_znet.id
    mapping.save()
    print(f"  Updated PackageMapping to use new integration: {shamtech_znet.id}")
else:
    print("  No PackageMapping found for ShamTech!")

print(f"\n" + "="*80)
print("ZNET INTEGRATION FOR SHAMTECH COMPLETE")
print("="*80)
