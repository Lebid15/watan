#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration

# Manual dispatch for new order
print("=== MANUAL DISPATCH FOR NEW ORDER ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    
    # Get the ShamTech provider
    shamtech_provider_id = "0c06ecba-e4dd-4b52-a9bb-b57d500a1278"
    provider = Integration.objects.get(id=shamtech_provider_id)
    print(f"ShamTech provider: {provider.name}")
    
    # Update order to forward to ShamTech
    order.provider_id = shamtech_provider_id
    order.external_order_id = f"stub-{order.id}"
    order.external_status = 'sent'
    order.status = 'sent'
    order.mode = 'MANUAL'
    order.save()
    
    print(f"\nOrder updated:")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    print(f"  Mode: {order.mode}")
    
    print("SUCCESS: Order forwarded to ShamTech!")
    
except ProductOrder.DoesNotExist:
    print("Order not found")
except Integration.DoesNotExist:
    print("ShamTech provider not found")

print("\n=== COMPLETE ===")




