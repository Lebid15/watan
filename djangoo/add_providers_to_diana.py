#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.tenants.models import Tenant

# Add providers to Diana tenant
print("=== ADDING PROVIDERS TO DIANA TENANT ===")

# Get Diana tenant
diana_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
try:
    diana_tenant = Tenant.objects.get(id=diana_tenant_id)
    print(f"Diana tenant found: {diana_tenant.name}")
except Tenant.DoesNotExist:
    print(f"Diana tenant not found: {diana_tenant_id}")
    exit(1)

# Get existing providers from Al-Sham to copy
alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
alsham_providers = Integration.objects.filter(tenant_id=alsham_tenant_id)
print(f"Found {alsham_providers.count()} providers in Al-Sham tenant")

# Copy providers to Diana
for provider in alsham_providers:
    print(f"\nCopying provider: {provider.name} ({provider.provider})")
    
    # Create new integration for Diana
    import uuid
    from django.utils import timezone
    now = timezone.now()
    
    new_integration = Integration.objects.create(
        id=uuid.uuid4(),
        tenant_id=diana_tenant_id,
        name=provider.name,
        provider=provider.provider,
        base_url=provider.base_url,
        api_token=provider.api_token,
        kod=provider.kod,
        sifre=provider.sifre,
        created_at=now
    )
    
    print(f"Created: {new_integration.id} - {new_integration.name}")

print(f"\n=== VERIFICATION ===")
diana_providers = Integration.objects.filter(tenant_id=diana_tenant_id)
print(f"Diana now has {diana_providers.count()} providers:")
for provider in diana_providers:
    print(f"  - {provider.id}: {provider.name} ({provider.provider})")

print("\n=== COMPLETE ===")
