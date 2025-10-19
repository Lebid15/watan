#!/usr/bin/env python
"""
Test auto-dispatch for pending orders in ShamTech
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
print("TESTING AUTO-DISPATCH FOR PENDING ORDERS IN SHAMTECH")
print("="*80)

# ShamTech tenant ID
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get pending orders
pending_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending'
).order_by('-created_at')[:2]

if not pending_orders.exists():
    print("No pending orders found")
    exit(0)

print(f"Found {pending_orders.count()} pending orders to test")

for order in pending_orders:
    print(f"\n{'='*60}")
    print(f"TESTING ORDER: {str(order.id)[:8]}...")
    print(f"{'='*60}")
    
    print(f"Order Details:")
    print(f"  ID: {order.id}")
    print(f"  Package: {order.package.name if order.package else 'Unknown'}")
    print(f"  Package ID: {order.package_id}")
    print(f"  User: {order.user_identifier}")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Mode: {order.mode}")
    
    print(f"\nAttempting auto-dispatch...")
    try:
        result = try_auto_dispatch_async(str(order.id), str(shamtech_tenant_id))
        print(f"Auto-dispatch result: {result}")
        
        # Refresh order from database
        order.refresh_from_db()
        print(f"\nOrder after auto-dispatch:")
        print(f"  Status: {order.status}")
        print(f"  Provider ID: {order.provider_id}")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  External Status: {order.external_status}")
        print(f"  Mode: {order.mode}")
        
        if order.external_order_id and order.external_order_id.startswith('znet-'):
            print(f"  SUCCESS: Order dispatched to ZNET!")
        elif order.external_order_id and order.external_order_id.startswith('stub-'):
            print(f"  CHAIN FORWARD: Order forwarded to next tenant")
        else:
            print(f"  FAILED: Order not dispatched")
            
    except Exception as e:
        print(f"ERROR during auto-dispatch: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*80}")
print("AUTO-DISPATCH TEST COMPLETE")
print("="*80)
