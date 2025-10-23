#!/usr/bin/env python
"""
Check chain forwarding configuration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration, ChainMapping

print("="*80)
print("CHECKING CHAIN FORWARDING CONFIGURATION")
print("="*80)

# Get the order
order = ProductOrder.objects.filter(
    id__icontains='15F599'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='15F599'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing 15F599 in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status}")
        order = orders.first()
    else:
        print("No order found containing 15F599")
        exit(1)

if order:
    print(f"\nOrder Details:")
    print(f"  ID: {order.id}")
    print(f"  Tenant ID: {order.tenant_id}")
    print(f"  Package ID: {order.package_id}")
    
    # Check ChainMapping
    print(f"\nChainMapping Configuration:")
    chain_mappings = ChainMapping.objects.filter(
        from_tenant_id=order.tenant_id,
        package_id=order.package_id
    )
    
    if chain_mappings.exists():
        print(f"  Found {chain_mappings.count()} chain mappings:")
        for mapping in chain_mappings:
            print(f"    - From Tenant: {mapping.from_tenant_id}")
            print(f"    - To Tenant: {mapping.to_tenant_id}")
            print(f"    - Package ID: {mapping.package_id}")
            print(f"    - Priority: {mapping.priority}")
    else:
        print("  No chain mappings found!")
    
    # Check PackageRouting
    print(f"\nPackageRouting Configuration:")
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    ).first()
    
    if routing:
        print(f"  Mode: {routing.mode}")
        print(f"  Provider Type: {routing.provider_type}")
        print(f"  Primary Provider ID: {routing.primary_provider_id}")
        
        if routing.primary_provider_id:
            provider = Integration.objects.filter(id=routing.primary_provider_id).first()
            if provider:
                print(f"  Provider Name: {provider.name}")
                print(f"  Provider Type: {provider.provider}")
    else:
        print("  No PackageRouting found!")
    
    # Check if there's a chain forwarding logic
    print(f"\nChecking for chain forwarding logic...")
    
    # Check if there are any chain mappings for this tenant
    all_chain_mappings = ChainMapping.objects.filter(
        from_tenant_id=order.tenant_id
    )
    
    if all_chain_mappings.exists():
        print(f"  Found {all_chain_mappings.count()} chain mappings for this tenant:")
        for mapping in all_chain_mappings:
            print(f"    - Package: {mapping.package_id}")
            print(f"    - To Tenant: {mapping.to_tenant_id}")
            print(f"    - Priority: {mapping.priority}")
    else:
        print("  No chain mappings found for this tenant!")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)



