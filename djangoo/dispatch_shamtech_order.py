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

# Dispatch ShamTech order to znet
print("=== DISPATCHING SHAMTECH ORDER TO ZNET ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

# Get the order in ShamTech
order = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending'
).first()

if not order:
    print("No pending orders found in ShamTech")
    exit(1)

print(f"Order: {order.id}")
print(f"External Order ID: {order.external_order_id}")
print(f"Package: {order.package.name if order.package else 'Unknown'}")
print(f"User: {order.user_identifier}")

# Get znet provider
znet_provider = Integration.objects.filter(
    tenant_id=shamtech_tenant_id,
    provider='znet'
).first()

if not znet_provider:
    print("No znet provider found for ShamTech")
    exit(1)

print(f"Znet provider: {znet_provider.name} ({znet_provider.id})")

# Use the admin panel bulk dispatch logic
print(f"\n=== USING ADMIN PANEL LOGIC ===")

# Simulate the admin panel request
from apps.orders.views import AdminOrdersBulkDispatchView
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser
from apps.users.models import LegacyUser

# Create a mock request
import json
factory = RequestFactory()
request = factory.post('/admin/orders/bulk/dispatch', 
    data=json.dumps({
        'ids': [str(order.id)],
        'providerId': str(znet_provider.id),
        'note': 'Manual dispatch to znet'
    }),
    content_type='application/json'
)

# Set tenant header
request.META['HTTP_X_TENANT_ID'] = shamtech_tenant_id

# Mock user
request.user = AnonymousUser()

# Create view instance
view = AdminOrdersBulkDispatchView()

try:
    print("Calling admin bulk dispatch...")
    response = view.post(request)
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.data}")
    
    # Check order after dispatch
    order.refresh_from_db()
    print(f"\nOrder after dispatch:")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    
    if order.provider_id and order.external_order_id:
        print("SUCCESS: Order dispatched to znet!")
    else:
        print("ERROR: Order not dispatched properly")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    print("Full traceback:")
    print(traceback.format_exc())

print("\n=== COMPLETE ===")
