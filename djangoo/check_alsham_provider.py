#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.tenants.models import Tenant

# Check the provider that Al-Sham will forward to
print("=== CHECKING AL-SHAM PROVIDER ===")

provider_id = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"

try:
    provider = Integration.objects.get(id=provider_id)
    print(f"Provider found: {provider.name}")
    print(f"Provider Type: {provider.provider}")
    print(f"Provider Tenant: {provider.tenant_id}")
    
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=provider.tenant_id)
        print(f"Provider Tenant Name: {tenant.name}")
        
        # Check if this is ShamTech
        shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
        if str(provider.tenant_id) == shamtech_tenant_id:
            print("SUCCESS: This provider belongs to ShamTech!")
        else:
            print(f"ERROR: This provider belongs to different tenant: {tenant.name}")
            
    except Tenant.DoesNotExist:
        print(f"Provider Tenant: Unknown")
        
except Integration.DoesNotExist:
    print("Provider not found")

print("\n=== COMPLETE ===")







