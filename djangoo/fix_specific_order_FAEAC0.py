#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration
import json

# Fix specific order FAEAC0
print("=== FIXING SPECIFIC ORDER FAEAC0 ===")

# Find the order
order_id = "f6abf117-e6ae-4c27-9f7e-83a60bfaeac0"
try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order found: {order.id}")
    print(f"Current Chain Path: {order.chain_path}")
    print(f"Provider ID: {order.provider_id}")
    
    if order.provider_id:
        try:
            integration = Integration.objects.get(id=order.provider_id, tenant_id=order.tenant_id)
            print(f"Integration Name: {integration.name}")
            
            # Set chain_path to the integration name
            chain_path = [integration.name]
            order.chain_path = json.dumps(chain_path)
            order.save(update_fields=['chain_path'])
            print(f"SUCCESS: Chain path set to: {chain_path}")
            
        except Integration.DoesNotExist:
            print("Integration not found")
    else:
        print("No provider_id")
        
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== VERIFICATION ===")
try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order ID: {order.id}")
    print(f"Chain Path: {order.chain_path}")
    if order.chain_path:
        try:
            chain_data = json.loads(order.chain_path)
            print(f"Chain Path Data: {chain_data}")
        except:
            print(f"Chain Path (raw): {order.chain_path}")
except ProductOrder.DoesNotExist:
    print("Order not found")







