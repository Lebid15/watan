#!/usr/bin/env python
"""
Fix wrong provider issue for order 7CD078
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration
from apps.orders.services import try_auto_dispatch_async

print("="*80)
print("FIXING WRONG PROVIDER ISSUE")
print("="*80)

# Get the order
order_id = "38cf33ef-6ad2-4203-baec-420aaf7cd078"
order = ProductOrder.objects.get(id=order_id)

print(f"Order: {order.id}")
print(f"Current Provider ID: {order.provider_id}")
print(f"Current External Order ID: {order.external_order_id}")
print(f"Current Status: {order.status}")

# Get the correct provider from routing
routing = PackageRouting.objects.get(
    package_id=order.package_id,
    tenant_id=order.tenant_id
)

correct_provider_id = routing.primary_provider_id
correct_provider = Integration.objects.get(id=correct_provider_id)

print(f"\nCorrect Provider (from routing):")
print(f"  ID: {correct_provider.id}")
print(f"  Name: {correct_provider.name}")
print(f"  Provider: {correct_provider.provider}")

# Clear the wrong provider assignment
print(f"\nClearing wrong provider assignment...")
order.provider_id = None
order.external_order_id = None
order.external_status = 'not_sent'  # Cannot be null
order.provider_message = None
order.last_message = None
order.save()

print(f"Order cleared:")
print(f"  Provider ID: {order.provider_id}")
print(f"  External Order ID: {order.external_order_id}")
print(f"  External Status: {order.external_status}")

# Now try auto-dispatch with correct provider
print(f"\nAttempting auto-dispatch with correct provider...")
try:
    result = try_auto_dispatch_async(str(order.id), str(order.tenant_id))
    print(f"Auto-dispatch result: {result}")
    
    # Refresh order
    order.refresh_from_db()
    print(f"\nOrder after auto-dispatch:")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    print(f"  Status: {order.status}")
    
    if order.provider_id == correct_provider_id:
        print(f"SUCCESS: Order now uses correct provider!")
    else:
        print(f"FAILED: Order still uses wrong provider")
        
except Exception as e:
    print(f"ERROR during auto-dispatch: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("FIX COMPLETE")
print("="*80)
