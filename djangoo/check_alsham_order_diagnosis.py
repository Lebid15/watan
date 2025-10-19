#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting, PackageMapping
from apps.tenants.models import Tenant
from apps.orders.services import try_auto_dispatch

print("=== Al-Sham Order Diagnosis ===")

# البحث عن أحدث طلب في Al-Sham
try:
    # البحث عن أحدث طلب في Al-Sham tenant
    alsham_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
    
    # البحث عن أحدث طلب
    order = ProductOrder.objects.filter(tenant_id=alsham_tenant_id).order_by('-created_at').first()
    
    if not order:
        print("[ERROR] No orders found in Al-Sham")
        exit(1)
    
    print(f"[OK] Order found: {order.id}")
    print(f"   - External Order ID: {order.external_order_id}")
    print(f"   - Status: {order.status}")
    print(f"   - Mode: {order.mode}")
    print(f"   - Provider ID: {order.provider_id}")
    print(f"   - External Status: {order.external_status}")
    print(f"   - Chain Path: {order.chain_path}")
    
    # Check routing settings
    print(f"\n=== Routing Settings Check ===")
    
    # 1. Check PackageRouting
    try:
        routing = PackageRouting.objects.get(
            package_id=order.package_id,
            tenant_id=order.tenant_id
        )
        print(f"[OK] PackageRouting exists:")
        print(f"   - Mode: {routing.mode}")
        print(f"   - Provider Type: {routing.provider_type}")
        print(f"   - Primary Provider: {routing.primary_provider_id}")
        print(f"   - Fallback Provider: {routing.fallback_provider_id}")
    except PackageRouting.DoesNotExist:
        print("[ERROR] No PackageRouting for this package")
        print("   This is why automatic routing failed!")
    
    # 2. Check available providers
    providers = Integration.objects.filter(tenant_id=order.tenant_id)
    print(f"\n=== Available Providers in Al-Sham ===")
    print(f"Provider count: {providers.count()}")
    for provider in providers:
        print(f"   - {provider.name} ({provider.provider}) - ID: {provider.id}")
    
    # 3. Check chain mapping in code
    print(f"\n=== Chain Mapping Check ===")
    alsham_tenant_id_str = str(alsham_tenant_id)
    print(f"Al-Sham Tenant ID: {alsham_tenant_id_str}")
    
    # Check chain mapping
    chain_mapping = {
        "7d37f00a-22f3-4e61-88d7-2a97b79d86fb": {  # Al-Sham tenant ID
            "target_tenant": "7d677574-21be-45f7-b520-22e0fe36b860",  # ShamTech tenant ID
            "target_package": "same",  # same package
            "target_user": "7a73edd8-183f-4fbd-a07b-6863b3f6b842",  # existing user
        },
    }
    
    if alsham_tenant_id_str in chain_mapping:
        print("[OK] Chain mapping exists in code")
        config = chain_mapping[alsham_tenant_id_str]
        print(f"   - Target Tenant: {config['target_tenant']}")
        print(f"   - Target Package: {config['target_package']}")
        print(f"   - Target User: {config['target_user']}")
    else:
        print("[ERROR] Chain mapping not found in code")
    
    # 4. Try manual dispatch
    print(f"\n=== Manual Dispatch Attempt ===")
    try:
        print("Calling try_auto_dispatch...")
        try_auto_dispatch(str(order.id), str(order.tenant_id))
        
        # Check result
        order.refresh_from_db()
        print(f"\nResult after attempt:")
        print(f"   - Status: {order.status}")
        print(f"   - Mode: {order.mode}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        print(f"   - External Status: {order.external_status}")
        print(f"   - Chain Path: {order.chain_path}")
        
        if order.mode == "CHAIN_FORWARD":
            print("[OK] Routing successful!")
        elif order.provider_id and order.external_order_id:
            print("[OK] Sent to provider!")
        else:
            print("[ERROR] Failed to route or send")
            
    except Exception as e:
        print(f"[ERROR] Routing error: {e}")
        import traceback
        print("Error details:")
        print(traceback.format_exc())

except Exception as e:
    print(f"[ERROR] General error: {e}")
    import traceback
    print("Error details:")
    print(traceback.format_exc())

print("\n=== Diagnosis Complete ===")
