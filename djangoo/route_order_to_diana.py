#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration
from apps.tenancy.models import Tenant

# Get the order
order_id = '2fd6924c-d783-4ae2-9946-0b7a3b7bafcd'
order = ProductOrder.objects.get(id=order_id)

print(f"\n{'='*60}")
print(f"📦 ORDER TO ROUTE")
print(f"{'='*60}")
print(f"Order ID: {order.id}")
print(f"Order No: {str(order.id)[-6:].upper()}")
print(f"Current Status: {order.status}")
print(f"External Status: {order.external_status}")
print(f"Current Provider: {order.provider_id or 'Manual'}")
print(f"Package ID: {order.package_id}")
print(f"User ID: {order.user_identifier}")

# Get alsham tenant
alsham_tenant = Tenant.objects.filter(name__icontains='sham').first()
if not alsham_tenant:
    alsham_tenant = Tenant.objects.first()

print(f"\n{'='*60}")
print(f"🏢 TENANT INFO")
print(f"{'='*60}")
print(f"Tenant ID: {alsham_tenant.id}")
print(f"Tenant Name: {alsham_tenant.name}")

# Get all providers for alsham
providers = Integration.objects.filter(tenant_id=alsham_tenant.id)

print(f"\n{'='*60}")
print(f"🔌 AVAILABLE PROVIDERS")
print(f"{'='*60}")
for p in providers:
    print(f"  {p.id}")
    print(f"    Name: {p.name}")
    print(f"    Provider: {p.provider}")
    print(f"    Enabled: {p.enabled}")
    print(f"    Type: {getattr(p, 'type', 'N/A')}")
    print()

# Find diana
diana = Integration.objects.filter(
    tenant_id=alsham_tenant.id,
    name__icontains='diana'
).first()

if diana:
    print(f"\n{'='*60}")
    print(f"🎯 DIANA PROVIDER FOUND!")
    print(f"{'='*60}")
    print(f"Provider ID: {diana.id}")
    print(f"Provider Name: {diana.name}")
    print(f"Provider Type: {diana.provider}")
    print(f"Enabled: {diana.enabled}")
    print(f"\nℹ️  To route the order to diana, update:")
    print(f"   order.provider_id = '{diana.id}'")
    print(f"   order.save()")
else:
    print(f"\n❌ DIANA provider not found!")
    print(f"Available providers:")
    for p in providers:
        print(f"  - {p.name}")
