#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
import json

# Fix chain_path to show "diana" instead of "Forwarded"
print("=== FIXING CHAIN PATH TO SHOW DIANA ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Current chain_path: {order.chain_path}")
    
    # Set chain_path to show "diana" as the next tenant
    chain_path = ["diana"]
    order.chain_path = json.dumps(chain_path)
    order.save(update_fields=['chain_path'])
    
    print(f"Updated chain_path: {order.chain_path}")
    print("SUCCESS: Chain path now shows 'diana'!")
    
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")




