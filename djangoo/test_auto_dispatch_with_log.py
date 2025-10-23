#!/usr/bin/env python
"""
Test auto-dispatch with detailed logging
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
print("TESTING AUTO-DISPATCH WITH DETAILED LOGGING")
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
        exit(1)

if order:
    print(f"\nOrder Details BEFORE:")
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
    
    # Clear the wrong provider assignment
    print(f"\nClearing wrong provider assignment...")
    order.provider_id = None
    order.external_order_id = None
    order.external_status = 'not_sent'
    order.provider_message = None
    order.last_message = None
    order.save()
    
    print(f"Order cleared:")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    
    # Now try auto-dispatch
    print(f"\nAttempting auto-dispatch...")
    try:
        result = try_auto_dispatch_async(str(order.id), str(order.tenant_id))
        print(f"\nAuto-dispatch result: {result}")
        
        # Refresh order
        order.refresh_from_db()
        print(f"\nOrder Details AFTER:")
        print(f"  Provider ID: {order.provider_id}")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  External Status: {order.external_status}")
        print(f"  Status: {order.status}")
        
        if order.external_status == 'sent':
            print(f"\nSUCCESS: Order dispatched successfully!")
        elif order.external_status == 'processing':
            print(f"\nPARTIAL: Order sent but status is processing")
        else:
            print(f"\nFAILED: Order not dispatched properly")
            
    except Exception as e:
        print(f"\nERROR during auto-dispatch: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)



