#!/usr/bin/env python
"""
Debug why order uses diana instead of alayaZnet
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration

print("="*80)
print("DEBUGGING WHY ORDER USES DIANA")
print("="*80)

# Find the latest order
order = ProductOrder.objects.filter(
    id__icontains='79455D'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='79455D'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing 79455D in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status}")
        order = orders.first()
    else:
        print("No order found containing 79455D")
        exit(1)

if order:
    print(f"\nOrder Details:")
    print(f"  ID: {order.id}")
    print(f"  Status: {order.status}")
    print(f"  User Identifier: {order.user_identifier}")
    print(f"  Package: {order.package.name if order.package else 'Unknown'}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Tenant ID: {order.tenant_id}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    print(f"  Mode: {order.mode}")
    print(f"  Created At: {order.created_at}")
    
    # Check if this is a chain forward order
    if hasattr(order, 'root_order_id') and order.root_order_id:
        print(f"  Root Order ID: {order.root_order_id}")
        print(f"  Chain Path: {order.chain_path}")
        print(f"  This is a chain forward order!")
    
    # Check PackageRouting for this tenant
    print(f"\nPackageRouting for Tenant {order.tenant_id}:")
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
    
    # Check what provider is actually being used
    if order.provider_id:
        actual_provider = Integration.objects.filter(id=order.provider_id).first()
        if actual_provider:
            print(f"\nActual Provider Used:")
            print(f"  ID: {actual_provider.id}")
            print(f"  Name: {actual_provider.name}")
            print(f"  Provider: {actual_provider.provider}")
            print(f"  Base URL: {actual_provider.base_url}")
            print(f"  Tenant ID: {actual_provider.tenant_id}")
            
            if routing and actual_provider.id != routing.primary_provider_id:
                print(f"  MISMATCH: Order uses {actual_provider.name} but routing says {routing.primary_provider_id}")
                
                # Check if the actual provider is from a different tenant
                if actual_provider.tenant_id != order.tenant_id:
                    print(f"  CROSS-TENANT: Provider belongs to tenant {actual_provider.tenant_id} but order belongs to {order.tenant_id}")

print("\n" + "="*80)
print("DEBUG COMPLETE")
print("="*80)



