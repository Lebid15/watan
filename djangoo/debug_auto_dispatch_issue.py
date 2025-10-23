#!/usr/bin/env python
"""
Debug why auto-dispatch doesn't work for new orders
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch_async

print("="*80)
print("DEBUGGING AUTO-DISPATCH ISSUE")
print("="*80)

# Find the latest order
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
    
    # Test auto-dispatch manually
    print(f"\nTesting auto-dispatch manually...")
    try:
        result = try_auto_dispatch_async(str(order.id), str(order.tenant_id))
        print(f"Auto-dispatch result: {result}")
        
        # Refresh order
        order.refresh_from_db()
        print(f"\nOrder after auto-dispatch:")
        print(f"  Provider ID: {order.provider_id}")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  External Status: {order.external_status}")
        print(f"  Status: {order.status}")
        
    except Exception as e:
        print(f"ERROR during auto-dispatch: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "="*80)
print("DEBUG COMPLETE")
print("="*80)



