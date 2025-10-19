#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageMapping

# Check the order after routing fix
print("=== CHECKING ORDER AFTER ROUTING FIX ===")

order_id = "de08a056-9e14-4494-9797-e9aa9092d77f"

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"Order: {order.id}")
    print(f"Status: {order.status}")
    print(f"Mode: {order.mode}")
    print(f"Provider ID: {order.provider_id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Package: {order.package.name if order.package else 'Unknown'}")
    
    # Check if routing is now correct
    if order.package:
        mapping = PackageMapping.objects.filter(
            tenant_id=order.tenant_id,
            our_package_id=order.package.id
        ).first()
        
        if mapping:
            print(f"\nPackageMapping:")
            print(f"  Provider API ID: {mapping.provider_api_id}")
            
            # Check if this provider is in ShamTech
            from apps.providers.models import Integration
            from apps.tenants.models import Tenant
            
            provider = Integration.objects.filter(id=mapping.provider_api_id).first()
            if provider:
                print(f"  Provider Name: {provider.name}")
                print(f"  Provider Tenant: {provider.tenant_id}")
                
                tenant = Tenant.objects.get(id=provider.tenant_id)
                print(f"  Provider Tenant Name: {tenant.name}")
                
                shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"
                if str(provider.tenant_id) == shamtech_tenant_id:
                    print("  SUCCESS: Provider is now in ShamTech!")
                else:
                    print(f"  ERROR: Provider is still in wrong tenant: {tenant.name}")
        else:
            print("No PackageMapping found")
    
except ProductOrder.DoesNotExist:
    print("Order not found")

print("\n=== COMPLETE ===")




