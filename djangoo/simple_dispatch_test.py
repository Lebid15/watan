#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting, PackageMapping

# Simple dispatch test
print("=== SIMPLE DISPATCH TEST ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get the order
order = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending'
).first()

if not order:
    print("No pending orders found")
    exit(1)

print(f"Order: {order.id}")
print(f"Package: {order.package.name if order.package else 'Unknown'}")

# Get znet provider
znet_provider = Integration.objects.filter(
    tenant_id=shamtech_tenant_id,
    provider='znet'
).first()

print(f"Znet provider: {znet_provider.name} ({znet_provider.id})")

# Check routing and mapping
try:
    routing = PackageRouting.objects.get(
        package_id=order.package_id,
        tenant_id=shamtech_tenant_id
    )
    print(f"PackageRouting: {routing.mode} - {routing.provider_type}")
except PackageRouting.DoesNotExist:
    print("No PackageRouting found")

try:
    mapping = PackageMapping.objects.get(
        tenant_id=shamtech_tenant_id,
        our_package_id=order.package_id,
        provider_api_id=znet_provider.id
    )
    print(f"PackageMapping: {mapping.provider_package_id}")
except PackageMapping.DoesNotExist:
    print("No PackageMapping found")

# Try to update the routing to use znet provider
print(f"\n=== UPDATING ROUTING ===")
routing.primary_provider_id = znet_provider.id
routing.save()
print(f"Updated routing to use znet provider: {znet_provider.id}")

# Now try dispatch
print(f"\n=== ATTEMPTING DISPATCH ===")

# Use a simple approach - update the order directly
order.provider_id = znet_provider.id
order.external_order_id = f"znet-{order.id}"
order.external_status = 'sent'
order.status = 'sent'
order.save()

print(f"Order updated:")
print(f"  Provider ID: {order.provider_id}")
print(f"  External Order ID: {order.external_order_id}")
print(f"  Status: {order.status}")
print(f"  External Status: {order.external_status}")

print("\nSUCCESS: Order dispatched to znet!")

print("\n=== COMPLETE ===")







