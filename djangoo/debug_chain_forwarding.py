#!/usr/bin/env python
"""
Debug chain forwarding logic
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import _determine_next_tenant_in_chain

print("="*80)
print("DEBUGGING CHAIN FORWARDING")
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
    
    # Check if this is a chain forward order
    if hasattr(order, 'root_order_id') and order.root_order_id:
        print(f"  Root Order ID: {order.root_order_id}")
        print(f"  Chain Path: {order.chain_path}")
        print(f"  This is a chain forward order!")
    
    # Test chain forwarding logic
    print(f"\nTesting chain forwarding logic...")
    try:
        chain_info = _determine_next_tenant_in_chain(
            current_tenant_id=str(order.tenant_id),
            package_id=str(order.package_id)
        )
        
        if chain_info:
            target_tenant_id, target_package_id, target_user_id = chain_info
            print(f"  Chain forwarding would create:")
            print(f"    - Target Tenant: {target_tenant_id}")
            print(f"    - Target Package: {target_package_id}")
            print(f"    - Target User: {target_user_id}")
        else:
            print(f"  No chain forwarding configured for this tenant")
            
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "="*80)
print("DEBUG COMPLETE")
print("="*80)



