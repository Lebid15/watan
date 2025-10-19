#!/usr/bin/env python
import os
import sys
import django
import uuid

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.tenants.models import Tenant
from django.db import connection

print("=== SETTING UP CHAIN ROUTING ===")

# Use known tenant IDs
alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"  # Al-Sham
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"  # ShamTech

# Find the package we just created
package_id = "36f2e41d-62ce-46d1-b1a7-9ac8e9cf4057"  # pubg global 180

print(f"Setting up routing for package: {package_id}")
print(f"Al-Sham tenant: {alsham_tenant_id}")
print(f"ShamTech tenant: {shamtech_tenant_id}")

# Create PackageRouting for Al-Sham
try:
    with connection.cursor() as cursor:
        # Check if routing already exists
        cursor.execute(
            'SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s',
            [alsham_tenant_id, package_id]
        )
        existing = cursor.fetchone()
        
        if existing:
            print("PackageRouting already exists, updating...")
            cursor.execute(
                'UPDATE package_routing SET mode=%s, "providerType"=%s WHERE id=%s',
                ['auto', 'external', existing[0]]
            )
        else:
            print("Creating new PackageRouting...")
            cursor.execute(
                'INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType") VALUES (gen_random_uuid(), %s, %s, %s, %s)',
                [alsham_tenant_id, package_id, 'auto', 'external']
            )
        
        print("[OK] PackageRouting created/updated for Al-Sham")
        
except Exception as e:
    print(f"ERROR creating PackageRouting: {e}")
    exit(1)

# Find znet provider in Al-Sham
try:
    znet_provider = Integration.objects.filter(
        tenant_id=alsham_tenant_id,
        provider='znet'
    ).first()
    
    if not znet_provider:
        print("ERROR: No znet provider found in Al-Sham")
        exit(1)
    
    print(f"Found znet provider: {znet_provider.name} ({znet_provider.id})")
    
    # Create PackageMapping
    try:
        with connection.cursor() as cursor:
            # Check if mapping already exists
            cursor.execute(
                'SELECT id FROM package_mappings WHERE "tenantId"=%s AND our_package_id=%s AND provider_api_id=%s',
                [alsham_tenant_id, package_id, str(znet_provider.id)]
            )
            existing = cursor.fetchone()
            
            if existing:
                print("PackageMapping already exists, updating...")
                cursor.execute(
                    'UPDATE package_mappings SET provider_package_id=%s WHERE id=%s',
                    ['632', existing[0]]  # Use the same package ID as before
                )
            else:
                print("Creating new PackageMapping...")
                cursor.execute(
                    'INSERT INTO package_mappings (id, "tenantId", our_package_id, provider_api_id, provider_package_id) VALUES (gen_random_uuid(), %s, %s, %s, %s)',
                    [alsham_tenant_id, package_id, str(znet_provider.id), '632']
                )
            
            print("[OK] PackageMapping created/updated")
            
    except Exception as e:
        print(f"ERROR creating PackageMapping: {e}")
        exit(1)
        
except Exception as e:
    print(f"ERROR finding znet provider: {e}")
    exit(1)

print("\n[OK] Chain routing setup complete!")
print("Now you can test chain forwarding with the test order.")




