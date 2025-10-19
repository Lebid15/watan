#!/usr/bin/env python
"""
Check the new order
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("="*80)
print("CHECKING NEW ORDER")
print("="*80)

# Find the latest order
order = ProductOrder.objects.filter(
    id__icontains='38567D'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='38567D'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing 38567D in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status} | {o.provider_id}")
        order = orders.first()
    else:
        print("No order found containing 38567D")
        
        # Try to find the latest order
        orders = ProductOrder.objects.order_by('-created_at')[:5]
        print(f"\nLatest 5 orders:")
        for o in orders:
            print(f"  - {str(o.id)[:8]} | {o.user_identifier} | {o.status} | {o.provider_id}")
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
    
    # Check if provider_id is diana
    if order.provider_id == '71544f6c-705e-4e7f-bc3c-c24dc90428b7':
        print(f"\n  WARNING: Provider ID is diana (ShamTech)!")
        print(f"  This is the WRONG provider!")
        
        # Check PackageRouting
        from apps.providers.models import PackageRouting
        routing = PackageRouting.objects.filter(
            package_id=order.package_id,
            tenant_id=order.tenant_id
        ).first()
        
        if routing:
            print(f"\n  PackageRouting says:")
            print(f"    Primary Provider ID: {routing.primary_provider_id}")
            print(f"    This should be used instead of diana!")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
