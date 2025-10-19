#!/usr/bin/env python
"""
Check specific order 7CD078
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.products.models import ProductPackage

print("="*80)
print("CHECKING SPECIFIC ORDER 7CD078")
print("="*80)

# Search for the order
order = ProductOrder.objects.filter(
    id__icontains='7CD078'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='7CD078'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing 7CD078 in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status}")
        order = orders.first()
    else:
        print("No order found containing 7CD078")
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
    
    # Check PackageRouting
    print(f"\nChecking PackageRouting:")
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    ).first()
    
    if routing:
        print(f"  Mode: {routing.mode}")
        print(f"  Provider Type: {routing.provider_type}")
        print(f"  Primary Provider: {routing.primary_provider_id}")
        
        if routing.primary_provider_id:
            provider = Integration.objects.filter(id=routing.primary_provider_id).first()
            if provider:
                print(f"  Provider Name: {provider.name}")
                print(f"  Provider Type: {provider.provider}")
    else:
        print("  No PackageRouting found!")
    
    # Check PackageMapping
    print(f"\nChecking PackageMapping:")
    mapping = PackageMapping.objects.filter(
        our_package_id=order.package_id,
        tenant_id=order.tenant_id
    ).first()
    
    if mapping:
        print(f"  Provider Package ID: {mapping.provider_package_id}")
        print(f"  Provider API ID: {mapping.provider_api_id}")
    else:
        print("  No PackageMapping found!")
    
    # Check if order is forwarded
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print(f"\nOrder is forwarded (stub):")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  This means the order was forwarded to another tenant")
    
    # Check if order was sent to external provider
    if order.external_order_id and not order.external_order_id.startswith('stub-'):
        print(f"\nOrder was sent to external provider:")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  Provider ID: {order.provider_id}")
        print(f"  External Status: {order.external_status}")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
