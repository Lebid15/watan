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

# Check the specific order F43942 in ShamTech
print("=== CHECKING ORDER F43942 IN SHAMTECH ===")

shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"

try:
    shamtech_tenant = Tenant.objects.get(id=shamtech_tenant_id)
    print(f"ShamTech tenant: {shamtech_tenant.name}")
except Tenant.DoesNotExist:
    print("ShamTech tenant not found")
    exit(1)

try:
    # Find the order by its ID and ensure it belongs to ShamTech
    order = ProductOrder.objects.get(id='F43942', tenant_id=shamtech_tenant_id)
    print(f"Found order: {order.id}")
    print(f"Tenant ID: {order.tenant_id} (ShamTech)")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"External Status: {order.external_status}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    print(f"User: {order.user_identifier}")
    print(f"Price: {order.price}")
    print(f"Cost Price USD: {order.cost_price_usd}")
    print(f"Chain Path (raw): {order.chain_path}")

    if order.provider_id:
        try:
            provider = Integration.objects.get(id=order.provider_id)
            print(f"Provider Name: {provider.name}")
            print(f"Provider Type: {provider.provider}")
        except Integration.DoesNotExist:
            print("Provider not found for this order.")
    
    if order.chain_path:
        try:
            chain_path_data = json.loads(order.chain_path)
            print(f"Chain Path (parsed): {chain_path_data}")
        except json.JSONDecodeError:
            print(f"Chain Path (invalid JSON): {order.chain_path}")

except ProductOrder.DoesNotExist:
    # If not found by ID, try searching by external_order_id
    try:
        order = ProductOrder.objects.get(external_order_id__icontains='F43942', tenant_id=shamtech_tenant_id)
        print(f"Found order by external_order_id: {order.id}")
        print(f"Tenant ID: {order.tenant_id} (ShamTech)")
        print(f"Status: {order.status}")
        print(f"Mode: {order.mode}")
        print(f"Provider ID: {order.provider_id}")
        print(f"External Order ID: {order.external_order_id}")
        print(f"External Status: {order.external_status}")
        print(f"Package: {order.package.name if order.package else 'Unknown'}")
        print(f"User: {order.user_identifier}")
        print(f"Price: {order.price}")
        print(f"Cost Price USD: {order.cost_price_usd}")
        print(f"Chain Path (raw): {order.chain_path}")

        if order.provider_id:
            try:
                provider = Integration.objects.get(id=order.provider_id)
                print(f"Provider Name: {provider.name}")
                print(f"Provider Type: {provider.provider}")
            except Integration.DoesNotExist:
                print("Provider not found for this order.")
        
        if order.chain_path:
            try:
                chain_path_data = json.loads(order.chain_path)
                print(f"Chain Path (parsed): {chain_path_data}")
            except json.JSONDecodeError:
                print(f"Chain Path (invalid JSON): {order.chain_path}")

    except ProductOrder.DoesNotExist:
        print(f"Order F43942 not found in ShamTech by ID or external_order_id.")
    except Exception as e:
        print(f"An error occurred while searching for order F43942: {e}")
except Exception as e:
    print(f"An error occurred while searching for order F43942: {e}")

print("\n=== COMPLETE ===")







