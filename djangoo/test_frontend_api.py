#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from apps.orders.views import AdminOrdersListView
import json

# Test frontend API call
print("=== TESTING FRONTEND API CALL ===")

alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

# Create a test request
factory = RequestFactory()
request = factory.get('/api/admin/orders/', {'tenant_id': alsham_tenant_id})

# Get the view
view = AdminOrdersListView()
view.request = request

# Get orders for Al-Sham tenant
alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

try:
    # Call the view
    response = view.get(request)
    
    if response.status_code == 200:
        data = json.loads(response.content)
        orders = data.get('items', [])
        
        print(f"Found {len(orders)} orders")
        
        for order in orders:
            if order.get('id') == 'de08a056-9e14-4494-9797-e9aa9092d77f':
                print(f"Found our order:")
                print(f"  ID: {order.get('id')}")
                print(f"  Chain Path: {order.get('chainPath')}")
                print(f"  Provider ID: {order.get('providerId')}")
                print(f"  External Order ID: {order.get('externalOrderId')}")
                print(f"  Mode: {order.get('mode')}")
                
                # Check chainPath structure
                chain_path = order.get('chainPath')
                if chain_path:
                    print(f"  Chain Path type: {type(chain_path)}")
                    print(f"  Chain Path keys: {chain_path.keys() if isinstance(chain_path, dict) else 'Not a dict'}")
                    if isinstance(chain_path, dict) and 'nodes' in chain_path:
                        print(f"  Chain Path nodes: {chain_path['nodes']}")
                        if chain_path['nodes'] and len(chain_path['nodes']) > 0:
                            print(f"  First node: {chain_path['nodes'][0]}")
                break
    else:
        print(f"API call failed with status: {response.status_code}")
        
except Exception as e:
    print(f"Error: {e}")

print("\n=== COMPLETE ===")
