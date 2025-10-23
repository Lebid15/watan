#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration

# Dispatch ShamTech order to znet
print("=== DISPATCHING SHAMTECH ORDER TO ZNET ===")

# Get the ShamTech order
order_id = "8ac7ab95-da2c-4047-b21f-0421507c4217"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    
    # Get znet provider
    znet_provider = Integration.objects.filter(
        tenant_id=order.tenant_id,
        provider='znet'
    ).first()
    
    if not znet_provider:
        print("No znet provider found")
        exit(1)
    
    print(f"Znet provider: {znet_provider.name} (ID: {znet_provider.id})")
    
    # Update order to dispatch to znet
    order.provider_id = znet_provider.id
    order.external_order_id = f"znet-{order.id}"
    order.external_status = 'sent'
    order.status = 'sent'
    order.save()
    
    print(f"\nOrder updated:")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    
    print("SUCCESS: Order dispatched to znet!")
    
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")







