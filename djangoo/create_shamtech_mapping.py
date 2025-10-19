#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration, PackageMapping
import uuid

print("=== Creating ShamTech PackageMapping ===")

try:
    shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
    package_id = "e3ce2ffa-403b-4e25-b43f-48b9a853f5ed"  # Package ID from the order
    znet_provider_id = "3070a372-0905-4ec8-9cd5-8ae2d233b1e7"  # znet provider ID
    
    print(f"ShamTech Tenant ID: {shamtech_tenant_id}")
    print(f"Package ID: {package_id}")
    print(f"Provider ID: {znet_provider_id}")
    
    # Check if PackageMapping already exists
    try:
        existing_mapping = PackageMapping.objects.get(
            tenant_id=shamtech_tenant_id,
            our_package_id=package_id,
            provider_api_id=znet_provider_id
        )
        print(f"[WARNING] PackageMapping already exists:")
        print(f"   - Provider Package ID: {existing_mapping.provider_package_id}")
    except PackageMapping.DoesNotExist:
        print(f"[OK] No PackageMapping found, creating new one...")
        
        # Use the same provider package ID as the existing mapping
        provider_package_id = "pubg_global_60"  # Same as existing mapping
        
        # Create PackageMapping
        mapping = PackageMapping.objects.create(
            id=uuid.uuid4(),
            tenant_id=shamtech_tenant_id,
            our_package_id=package_id,
            provider_api_id=znet_provider_id,
            provider_package_id=provider_package_id
        )
        
        print(f"[OK] PackageMapping created successfully!")
        print(f"   - ID: {mapping.id}")
        print(f"   - Our Package: {mapping.our_package_id}")
        print(f"   - Provider: {mapping.provider_api_id}")
        print(f"   - Provider Package: {mapping.provider_package_id}")

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Creation Complete ===")

