#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Check all orders in ShamTech tenant
print("=== CHECKING ALL ORDERS IN SHAMTECH TENANT ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get ShamTech tenant
try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

# Find ALL orders in ShamTech (not just pending)
orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id
).order_by('-created_at')

print(f"\nFound {orders.count()} total orders in ShamTech:")

for i, order in enumerate(orders[:10]):  # Show first 10
    print(f"\n{i+1}. Order:")
    print(f"   ID: {order.id}")
    print(f"   External Order ID: {order.external_order_id}")
    print(f"   Status: {order.status}")
    print(f"   Mode: {order.mode}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   Package: {order.package.name if order.package else 'Unknown'}")
    print(f"   User Identifier: {order.user_identifier}")
    print(f"   Quantity: {order.quantity}")
    print(f"   Price: {order.price}")
    print(f"   Created: {order.created_at}")

# Also check if there are any orders with external_order_id containing F43942
print(f"\n=== SEARCHING FOR F43942 ===")
f43942_orders = ProductOrder.objects.filter(
    external_order_id__icontains='F43942'
)

print(f"Found {f43942_orders.count()} orders with F43942 in external_order_id:")
for order in f43942_orders:
    print(f"  - {order.id}: {order.external_order_id} (Tenant: {order.tenant_id})")

print("\n=== COMPLETE ===")




