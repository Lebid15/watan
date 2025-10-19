#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.tenants.models import Tenant

# Debug dispatch failed error
print("=== DEBUGGING DISPATCH FAILED ERROR ===")

# Find orders that might have dispatch issues
print("\n1. Checking for orders with dispatch issues...")

# Find orders that are pending and have provider_id but no external_order_id
problematic_orders = ProductOrder.objects.filter(
    status='pending',
    provider_id__isnull=False,
    external_order_id__isnull=True
).select_related('package')

print(f"Found {problematic_orders.count()} potentially problematic orders")

for order in problematic_orders[:5]:  # Check first 5
    print(f"\n--- Order {order.id} ---")
    # Get tenant name
    try:
        tenant = Tenant.objects.get(id=order.tenant_id)
        tenant_name = tenant.name
    except Tenant.DoesNotExist:
        tenant_name = 'Unknown'
    print(f"Tenant: {tenant_name}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Status: {order.status}")
    
    # Check PackageRouting
    try:
        routing = PackageRouting.objects.get(
            package_id=order.package_id,
            tenant_id=order.tenant_id
        )
        print(f"✅ PackageRouting found:")
        print(f"   Mode: {routing.mode}")
        print(f"   Provider Type: {routing.provider_type}")
        print(f"   Primary Provider ID: {routing.primary_provider_id}")
        
        # Check if routing matches the order's provider_id
        if str(routing.primary_provider_id) == str(order.provider_id):
            print(f"✅ Provider ID matches routing")
        else:
            print(f"❌ Provider ID mismatch!")
            print(f"   Order provider: {order.provider_id}")
            print(f"   Routing provider: {routing.primary_provider_id}")
            
    except PackageRouting.DoesNotExist:
        print(f"❌ No PackageRouting found")
    
    # Check PackageMapping
    try:
        mapping = PackageMapping.objects.get(
            tenant_id=order.tenant_id,
            our_package_id=order.package_id,
            provider_api_id=order.provider_id
        )
        print(f"✅ PackageMapping found:")
        print(f"   Provider Package ID: {mapping.provider_package_id}")
    except PackageMapping.DoesNotExist:
        print(f"❌ No PackageMapping found")
    
    # Check Integration
    try:
        integration = Integration.objects.get(
            id=order.provider_id,
            tenant_id=order.tenant_id
        )
        print(f"✅ Integration found:")
        print(f"   Provider: {integration.provider}")
        print(f"   Base URL: {integration.base_url}")
        print(f"   Has API Token: {bool(integration.api_token)}")
    except Integration.DoesNotExist:
        print(f"❌ No Integration found")

print("\n2. Checking for common dispatch failure patterns...")

# Check for missing PackageMappings
missing_mappings = []
for order in problematic_orders:
    try:
        PackageMapping.objects.get(
            tenant_id=order.tenant_id,
            our_package_id=order.package_id,
            provider_api_id=order.provider_id
        )
    except PackageMapping.DoesNotExist:
        missing_mappings.append(order)

if missing_mappings:
    print(f"❌ Found {len(missing_mappings)} orders with missing PackageMappings")
    for order in missing_mappings[:3]:
        print(f"   - Order {order.id}: Package {order.package_id} -> Provider {order.provider_id}")
else:
        print("OK: All orders have PackageMappings")

# Check for missing Integrations
missing_integrations = []
for order in problematic_orders:
    try:
        Integration.objects.get(
            id=order.provider_id,
            tenant_id=order.tenant_id
        )
    except Integration.DoesNotExist:
        missing_integrations.append(order)

if missing_integrations:
    print(f"❌ Found {len(missing_integrations)} orders with missing Integrations")
    for order in missing_integrations[:3]:
        print(f"   - Order {order.id}: Provider {order.provider_id}")
else:
        print("OK: All orders have Integrations")

print("\n3. Checking for routing configuration issues...")

# Check for routing mismatches
routing_mismatches = []
for order in problematic_orders:
    try:
        routing = PackageRouting.objects.get(
            package_id=order.package_id,
            tenant_id=order.tenant_id
        )
        if str(routing.primary_provider_id) != str(order.provider_id):
            routing_mismatches.append((order, routing))
    except PackageRouting.DoesNotExist:
        pass

if routing_mismatches:
    print(f"❌ Found {len(routing_mismatches)} orders with routing mismatches")
    for order, routing in routing_mismatches[:3]:
        print(f"   - Order {order.id}:")
        print(f"     Order provider: {order.provider_id}")
        print(f"     Routing provider: {routing.primary_provider_id}")
else:
    print("OK: No routing mismatches found")

print("\n=== DIAGNOSIS COMPLETE ===")
