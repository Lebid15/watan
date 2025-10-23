#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant

# Check all orders in ShamTech
print("=== CHECKING ALL SHAMTECH ORDERS ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get ShamTech tenant
try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

# Find ALL orders in ShamTech
orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id
).order_by('-created_at')

print(f"Found {orders.count()} orders in ShamTech:")

for i, order in enumerate(orders):
    print(f"\n{i+1}. Order:")
    print(f"   ID: {order.id}")
    print(f"   External Order ID: {order.external_order_id}")
    print(f"   Status: {order.status}")
    print(f"   Mode: {order.mode}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   Package: {order.package.name if order.package else 'Unknown'}")
    print(f"   User: {order.user_identifier}")
    print(f"   Price: {order.price}")
    print(f"   Chain Path: {order.chain_path}")
    
    # Check if this is the test_user_123 order
    if order.user_identifier == "test_user_123":
        print(f"   *** THIS IS THE TEST ORDER! ***")

print("\n=== COMPLETE ===")







