#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.serializers import AdminOrderListItemSerializer

# Test API response for the order
print("=== TESTING API RESPONSE ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Chain Path (raw): {order.chain_path}")
    
    # Test serializer
    serializer = AdminOrderListItemSerializer(order)
    data = serializer.data
    
    print(f"Serialized chainPath: {data.get('chainPath')}")
    print(f"Provider ID: {data.get('providerId')}")
    print(f"External Order ID: {data.get('externalOrderId')}")
    print(f"Mode: {data.get('mode')}")
    
    # Check if chainPath has nodes
    chain_path = data.get('chainPath')
    if chain_path and 'nodes' in chain_path:
        print(f"Chain Path nodes: {chain_path['nodes']}")
        if chain_path['nodes'] and len(chain_path['nodes']) > 0:
            print(f"First node: {chain_path['nodes'][0]}")
    else:
        print("No chainPath nodes found")
        
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")