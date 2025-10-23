#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch_async

# Test dispatch for new order
print("=== TESTING DISPATCH FOR NEW ORDER ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    
    # Try async dispatch
    print(f"\n=== ATTEMPTING ASYNC DISPATCH ===")
    try:
        result = try_auto_dispatch_async(order.id)
        print(f"Async dispatch result: {result}")
    except Exception as e:
        print(f"Async dispatch error: {e}")
        result = {'dispatched': False, 'reason': 'error'}
    
    # Check order after dispatch
    order.refresh_from_db()
    print(f"\nOrder after dispatch:")
    print(f"  Status: {order.status}")
    print(f"  Mode: {order.mode}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    
    if order.external_order_id and order.external_order_id.startswith('stub-'):
        print("SUCCESS: Order was forwarded to another tenant!")
    elif order.external_order_id:
        print("SUCCESS: Order was dispatched to external provider!")
    else:
        print("Order was not dispatched")
        
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")







