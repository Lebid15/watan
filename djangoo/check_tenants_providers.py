#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tenants.models import Tenant
from apps.providers.models import Integration

# Check tenants and providers
print("=== CHECKING TENANTS AND PROVIDERS ===")

# List all tenants
tenants = Tenant.objects.all()
print(f"\nTotal tenants: {tenants.count()}")
for tenant in tenants:
    print(f"  - {tenant.id}: {tenant.name.encode('ascii', 'ignore').decode()}")

# List all integrations
integrations = Integration.objects.all()
print(f"\nTotal integrations: {integrations.count()}")
for integration in integrations:
    print(f"  - {integration.id}: {integration.name.encode('ascii', 'ignore').decode()} ({integration.provider}) - Tenant: {integration.tenant_id}")

# Check specific tenant from the test
tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
try:
    tenant = Tenant.objects.get(id=tenant_id)
    print(f"\nSpecific tenant {tenant_id}: {tenant.name.encode('ascii', 'ignore').decode()}")
    
    # Check providers for this tenant
    tenant_providers = Integration.objects.filter(tenant_id=tenant_id)
    print(f"Providers for this tenant: {tenant_providers.count()}")
    for provider in tenant_providers:
        print(f"  - {provider.id}: {provider.name.encode('ascii', 'ignore').decode()} ({provider.provider})")
        
except Tenant.DoesNotExist:
    print(f"\nTenant {tenant_id} not found")

print("\n=== CHECK COMPLETE ===")
