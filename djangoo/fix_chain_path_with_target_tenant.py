#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.tenants.models import Tenant
from apps.providers.models import Integration
import json

# Fix chain_path to include target tenant name for forwarded orders
print("=== FIXING CHAIN_PATH WITH TARGET TENANT NAME ===")

# Find orders that were forwarded to internal tenants
forwarded_orders = ProductOrder.objects.filter(
    provider_id__isnull=False,
    mode='MANUAL'
).exclude(chain_path__isnull=False)

print(f"Found {forwarded_orders.count()} orders that might be forwarded to internal tenants")

for order in forwarded_orders:
    print(f"\nProcessing order: {order.id}")
    print(f"Provider ID: {order.provider_id}")
    print(f"Current Chain Path: {order.chain_path}")
    
    try:
        # Get the provider (Integration) to see if it's an internal tenant
        integration = Integration.objects.get(id=order.provider_id, tenant_id=order.tenant_id)
        print(f"Integration Name: {integration.name}")
        
        # Check if this integration represents an internal tenant
        # For now, we'll assume any integration with a name is an internal tenant
        if integration.name:
            # This is forwarded to an internal tenant
            target_tenant_name = integration.name
            chain_path = [target_tenant_name]
            order.chain_path = json.dumps(chain_path)
            order.save(update_fields=['chain_path'])
            print(f"SUCCESS: Chain path set to: {chain_path}")
        else:
            print("Integration has no name, skipping")
            
    except Integration.DoesNotExist:
        print("Integration not found, skipping")
    except Exception as e:
        print(f"ERROR: {e}")

print("\n=== VERIFICATION ===")
# Verify the fix
updated_orders = ProductOrder.objects.filter(
    provider_id__isnull=False,
    mode='MANUAL',
    chain_path__isnull=False
).exclude(chain_path='["Forwarded"]')

for order in updated_orders:
    print(f"Order ID: {order.id}")
    print(f"Chain Path: {order.chain_path}")
    if order.chain_path:
        try:
            chain_data = json.loads(order.chain_path)
            print(f"Chain Path Data: {chain_data}")
        except:
            print(f"Chain Path (raw): {order.chain_path}")
    print("---")




