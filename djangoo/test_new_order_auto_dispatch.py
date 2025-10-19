#!/usr/bin/env python
"""
Test new order auto-dispatch
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
print("TESTING NEW ORDER AUTO-DISPATCH")
print("="*80)

# Find the new order F80B0D
order = ProductOrder.objects.filter(
    id__icontains='F80B0D'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='F80B0D'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing F80B0D in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status}")
        order = orders.first()
    else:
        print("No order found containing F80B0D")
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
    
    # Test auto-dispatch
    print(f"\nTesting auto-dispatch...")
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
        
        if order.external_status == 'sent':
            print(f"SUCCESS: Order dispatched successfully!")
        elif order.external_status == 'processing':
            print(f"PARTIAL: Order sent but status is processing")
        else:
            print(f"FAILED: Order not dispatched properly")
            
    except Exception as e:
        print(f"ERROR during auto-dispatch: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
