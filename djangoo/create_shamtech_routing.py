#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration, PackageRouting, PackageMapping
from apps.tenants.models import Tenant
import uuid

print("=== Creating ShamTech PackageRouting ===")

try:
    shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
    package_id = "e3ce2ffa-403b-4e25-b43f-48b9a853f5ed"  # Package ID from the order
    
    print(f"ShamTech Tenant ID: {shamtech_tenant_id}")
    print(f"Package ID: {package_id}")
    
    # Check if PackageRouting already exists
    try:
        existing_routing = PackageRouting.objects.get(
            package_id=package_id,
            tenant_id=shamtech_tenant_id
        )
        print(f"[WARNING] PackageRouting already exists:")
        print(f"   - Mode: {existing_routing.mode}")
        print(f"   - Provider Type: {existing_routing.provider_type}")
        print(f"   - Primary Provider: {existing_routing.primary_provider_id}")
    except PackageRouting.DoesNotExist:
        print(f"[OK] No PackageRouting found, creating new one...")
        
        # Get available providers in ShamTech
        providers = Integration.objects.filter(tenant_id=shamtech_tenant_id)
        print(f"\n=== Available Providers in ShamTech ===")
        print(f"Provider count: {providers.count()}")
        for provider in providers:
            print(f"   - {provider.name} ({provider.provider}) - ID: {provider.id}")
        
        # Find znet provider
        znet_provider = providers.filter(provider='znet').first()
        if not znet_provider:
            print("[ERROR] No znet provider found in ShamTech")
            exit(1)
        
        print(f"\n[OK] Using znet provider: {znet_provider.name} ({znet_provider.id})")
        
        # Create PackageRouting
        routing = PackageRouting.objects.create(
            id=uuid.uuid4(),
            tenant_id=shamtech_tenant_id,
            package_id=package_id,
            mode='auto',
            provider_type='external',
            primary_provider_id=str(znet_provider.id),
            fallback_provider_id=None
        )
        
        print(f"[OK] PackageRouting created successfully!")
        print(f"   - ID: {routing.id}")
        print(f"   - Mode: {routing.mode}")
        print(f"   - Provider Type: {routing.provider_type}")
        print(f"   - Primary Provider: {routing.primary_provider_id}")
        
        # Check if PackageMapping exists
        try:
            mapping = PackageMapping.objects.get(
                tenant_id=shamtech_tenant_id,
                our_package_id=package_id,
                provider_api_id=znet_provider.id
            )
            print(f"[OK] PackageMapping already exists:")
            print(f"   - Provider Package ID: {mapping.provider_package_id}")
        except PackageMapping.DoesNotExist:
            print(f"[WARNING] No PackageMapping found for this package")
            print(f"   - Tenant ID: {shamtech_tenant_id}")
            print(f"   - Package ID: {package_id}")
            print(f"   - Provider ID: {znet_provider.id}")
            print(f"   - This might cause dispatch to fail")
            
            # List available mappings
            print(f"\n=== Available PackageMappings in ShamTech ===")
            mappings = PackageMapping.objects.filter(tenant_id=shamtech_tenant_id)
            print(f"Found {mappings.count()} mappings:")
            for mapping in mappings:
                print(f"   - Our Package: {mapping.our_package_id}")
                print(f"     Provider: {mapping.provider_api_id}")
                print(f"     Provider Package: {mapping.provider_package_id}")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Creation Complete ===")

