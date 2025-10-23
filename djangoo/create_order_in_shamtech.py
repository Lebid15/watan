#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import ProductPackage
from apps.users.models import LegacyUser
from apps.tenants.models import Tenant
from django.utils import timezone
import uuid
import json

# Create order in ShamTech
print("=== CREATING ORDER IN SHAMTECH ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

# Get ShamTech tenant
try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

# Get a package in ShamTech
package = ProductPackage.objects.filter(
    tenant_id=shamtech_tenant_id
).first()

if not package:
    print("No packages found in ShamTech")
    exit(1)

print(f"Package: {package.name}")

# Get a user in ShamTech
user = LegacyUser.objects.filter(tenant_id=shamtech_tenant_id).first()
if not user:
    print("No users found in ShamTech")
    exit(1)

print(f"User: {user.username}")

# Create new order in ShamTech (forwarded from Al-Sham)
now = timezone.now()
order = ProductOrder.objects.create(
    id=uuid.uuid4(),
    tenant_id=shamtech_tenant_id,
    user_id=user.id,
    package_id=package.id,
    product_id=package.product_id,
    user_identifier="test_user_123",
    quantity=1,
    price=10.00,
    status='pending',
    mode='MANUAL',
    created_at=now,
    notes="Forwarded from Al-Sham",
    external_order_id=f"stub-{uuid.uuid4()}",
    chain_path=json.dumps(["diana", "shamtech"])
)

print(f"\nCreated order in ShamTech:")
print(f"  ID: {order.id}")
print(f"  External Order ID: {order.external_order_id}")
print(f"  Status: {order.status}")
print(f"  Mode: {order.mode}")
print(f"  Package: {order.package.name if order.package else 'Unknown'}")
print(f"  User: {order.user_identifier}")
print(f"  Price: {order.price}")
print(f"  Chain Path: {order.chain_path}")

print("\nSUCCESS: Order created in ShamTech!")

print("\n=== COMPLETE ===")







