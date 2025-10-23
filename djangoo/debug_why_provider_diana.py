#!/usr/bin/env python
"""
Debug why provider_id is set to diana
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration

print("="*80)
print("DEBUGGING WHY PROVIDER_ID IS DIANA")
print("="*80)

# Find the latest order
order = ProductOrder.objects.filter(
    id__icontains='79455D'
).first()

if not order:
    # Search by user_identifier
    orders = ProductOrder.objects.filter(
        user_identifier__icontains='79455D'
    ).order_by('-created_at')[:5]
    
    if orders.exists():
        print(f"Found {orders.count()} orders containing 79455D in user_identifier:")
        for o in orders:
            print(f"  - {o.id} | {o.user_identifier} | {o.status}")
        order = orders.first()
    else:
        print("No order found containing 79455D")
        exit(1)

if order:
    print(f"\nOrder Details:")
    print(f"  ID: {order.id}")
    print(f"  Status: {order.status}")
    print(f"  User Identifier: {order.user_identifier}")
    print(f"  Package: {order.package.name if order.package else 'Unknown'}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Tenant ID: {order.tenant_id}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    print(f"  Mode: {order.mode}")
    
    # Check if this is a chain forward order
    if hasattr(order, 'root_order_id') and order.root_order_id:
        print(f"  Root Order ID: {order.root_order_id}")
        print(f"  Chain Path: {order.chain_path}")
        print(f"  This is a chain forward order!")
    
    # Check the provider
    if order.provider_id:
        provider = Integration.objects.filter(id=order.provider_id).first()
        if provider:
            print(f"\nProvider Details:")
            print(f"  ID: {provider.id}")
            print(f"  Name: {provider.name}")
            print(f"  Provider: {provider.provider}")
            print(f"  Base URL: {provider.base_url}")
            print(f"  Tenant ID: {provider.tenant_id}")
            print(f"  Enabled: {provider.enabled}")
            
            # Check if this is a cross-tenant provider
            if provider.tenant_id != order.tenant_id:
                print(f"  CROSS-TENANT: Provider belongs to tenant {provider.tenant_id} but order belongs to {order.tenant_id}")
                
                # Check if this is ShamTech
                if provider.tenant_id == "71544f6c-705e-4e7f-bc3c-c24dc90428b7":
                    print(f"  This is ShamTech provider!")
                    
                    # Check if ShamTech has ZNET integration
                    from apps.providers.models import Integration
                    shamtech_znet = Integration.objects.filter(
                        tenant_id="71544f6c-705e-4e7f-bc3c-c24dc90428b7",
                        provider='znet'
                    ).first()
                    
                    if shamtech_znet:
                        print(f"  ShamTech has ZNET integration: {shamtech_znet.name}")
                    else:
                        print(f"  ShamTech does NOT have ZNET integration!")
                        
                        # Check if ShamTech has PackageRouting
                        from apps.providers.models import PackageRouting
                        shamtech_routing = PackageRouting.objects.filter(
                            tenant_id="71544f6c-705e-4e7f-bc3c-c24dc90428b7",
                            package_id=order.package_id
                        ).first()
                        
                        if shamtech_routing:
                            print(f"  ShamTech has PackageRouting: {shamtech_routing.mode}")
                        else:
                            print(f"  ShamTech does NOT have PackageRouting!")

print("\n" + "="*80)
print("DEBUG COMPLETE")
print("="*80)



