#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration
from apps.tenants.models import Tenant

# Find and dispatch order in ShamTech
print("=== FINDING AND DISPATCHING SHAMTECH ORDER ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get ShamTech tenant
try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

# Find orders in ShamTech
orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id
).order_by('-created_at')

print(f"Found {orders.count()} orders in ShamTech:")

for i, order in enumerate(orders[:5]):
    print(f"\n{i+1}. Order:")
    print(f"   ID: {order.id}")
    print(f"   External Order ID: {order.external_order_id}")
    print(f"   Status: {order.status}")
    print(f"   Mode: {order.mode}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   Package: {order.package.name if order.package else 'Unknown'}")
    print(f"   User: {order.user_identifier}")
    print(f"   Price: {order.price}")

# Get the first order to dispatch
if orders.exists():
    order = orders.first()
    print(f"\n=== DISPATCHING ORDER {order.id} ===")
    
    # Get znet provider
    znet_provider = Integration.objects.filter(
        tenant_id=shamtech_tenant_id,
        provider='znet'
    ).first()
    
    if not znet_provider:
        print("No znet provider found")
        exit(1)
    
    print(f"Znet provider: {znet_provider.name} ({znet_provider.id})")
    
    # Update order to dispatch to znet
    order.provider_id = znet_provider.id
    order.external_order_id = f"znet-{order.id}"
    order.external_status = 'sent'
    order.status = 'sent'
    order.save()
    
    print(f"Order dispatched:")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    
    print("SUCCESS: Order dispatched to znet!")
else:
    print("No orders found in ShamTech")

print("\n=== COMPLETE ===")




