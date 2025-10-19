#!/usr/bin/env python
import os
import sys
import django
import uuid
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import Product, ProductPackage
from apps.users.legacy_models import LegacyUser
from apps.tenants.models import Tenant
from django.utils import timezone

print("=== CREATING TEST ORDER FOR CHAIN FORWARDING ===")

# Use known tenant IDs from the system
alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"  # Al-Sham
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"  # ShamTech

try:
    alsham_tenant = Tenant.objects.get(id=alsham_tenant_id)
    print(f"Found Al-Sham tenant: {alsham_tenant.id} - {alsham_tenant.name}")
except Tenant.DoesNotExist:
    print("ERROR: Al-Sham tenant not found")
    exit(1)

try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"Found ShamTech tenant: {shamtech_tenant.id} - {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ERROR: ShamTech tenant not found")
    exit(1)

# Find a package in Al-Sham
try:
    alsham_package = ProductPackage.objects.filter(tenant_id=alsham_tenant.id).first()
    if not alsham_package:
        print("ERROR: No packages found in Al-Sham tenant")
        exit(1)
    print(f"Found Al-Sham package: {alsham_package.id} - {alsham_package.name}")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)

# Find a user in Al-Sham
try:
    alsham_user = LegacyUser.objects.filter(tenant_id=alsham_tenant.id).first()
    if not alsham_user:
        print("ERROR: No users found in Al-Sham tenant")
        exit(1)
    print(f"Found Al-Sham user: {alsham_user.id} - {alsham_user.username}")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)

# Create test order
try:
    test_order = ProductOrder.objects.create(
        id=uuid.uuid4(),
        tenant_id=alsham_tenant.id,
        user_id=alsham_user.id,
        product_id=alsham_package.product_id,
        package_id=alsham_package.id,
        quantity=1,
        status='pending',  # مهم: pending وليس rejected
        price=Decimal('10.00'),
        sell_price_currency='USD',
        sell_price_amount=Decimal('10.00'),
        created_at=timezone.now(),
        user_identifier='test123',
        extra_field='chain_test',
        notes=[],
        notes_count=0,
    )
    
    print(f"\n[OK] Test order created successfully!")
    print(f"  Order ID: {test_order.id}")
    print(f"  Tenant: {alsham_tenant.name}")
    print(f"  Package: {alsham_package.name}")
    print(f"  User: {alsham_user.username}")
    print(f"  Status: {test_order.status}")
    print(f"  User Identifier: {test_order.user_identifier}")
    
    # Test chain forwarding
    print(f"\n=== TESTING CHAIN FORWARDING ===")
    from apps.orders.services import try_auto_dispatch
    
    try:
        print("Calling try_auto_dispatch...")
        try_auto_dispatch(str(test_order.id), str(alsham_tenant.id))
        
        # Check result
        test_order.refresh_from_db()
        print(f"\nResult:")
        print(f"  Status: {test_order.status}")
        print(f"  Provider ID: {test_order.provider_id}")
        print(f"  External Order ID: {test_order.external_order_id}")
        print(f"  External Status: {test_order.external_status}")
        print(f"  Mode: {test_order.mode}")
        print(f"  Chain Path: {test_order.chain_path}")
        
        if test_order.provider_id == "CHAIN_FORWARD":
            print("[OK] Chain forwarding successful!")
        else:
            print("[WARNING] Chain forwarding may not have worked")
            
    except Exception as e:
        print(f"ERROR during dispatch: {e}")
        import traceback
        print("Full traceback:")
        print(traceback.format_exc())
    
except Exception as e:
    print(f"ERROR creating test order: {e}")
    import traceback
    print("Full traceback:")
    print(traceback.format_exc())

print("\n=== COMPLETE ===")
