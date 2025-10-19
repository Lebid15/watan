"""#!/usr/bin/env python

Test auto-dispatch manually for existing orderimport os

"""import sys

import osimport django

import sys

import django# Setup Django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))django.setup()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django.setup()from apps.orders.models import ProductOrder

from apps.orders.services import try_auto_dispatch

from apps.orders.services import try_auto_dispatchfrom apps.providers.models import Integration

from apps.tenants.models import Tenant

# ShamTech order (forwarded from Al-Sham)

shamtech_order_id = "fe1db7e9-0bdf-4271-aa04-0b15346f058a"# Test manual dispatch

shamtech_tenant_id = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"print("=== TESTING MANUAL DISPATCH ===")



print("\n" + "="*80)# Find a pending order to test with

print("MANUAL TEST - try_auto_dispatch")pending_orders = ProductOrder.objects.filter(

print("="*80 + "\n")    status='pending',

    provider_id__isnull=True

print(f"Testing with order: {shamtech_order_id[:8]}...")).select_related('package')

print(f"Tenant: ShamTech ({shamtech_tenant_id[:8]}...)")

print()print(f"Found {pending_orders.count()} pending orders without provider_id")



try:if pending_orders.exists():

    result = try_auto_dispatch(shamtech_order_id, shamtech_tenant_id)    order = pending_orders.first()

    print("\n" + "="*80)    print(f"\nTesting with order: {order.id}")

    print("AUTO-DISPATCH COMPLETED")    print(f"Tenant: {order.tenant_id}")

    print("="*80)    print(f"Package: {order.package.name if order.package else 'Unknown'}")

        print(f"Status: {order.status}")

    # Check result    print(f"Provider ID: {order.provider_id}")

    from apps.orders.models import ProductOrder    print(f"External Order ID: {order.external_order_id}")

    order = ProductOrder.objects.get(id=shamtech_order_id)    

        # Find available providers for this tenant

    print(f"\nOrder state after dispatch:")    providers = Integration.objects.filter(tenant_id=order.tenant_id)

    print(f"  Status: {order.status}")    print(f"\nAvailable providers for tenant {order.tenant_id}:")

    print(f"  Provider ID: {order.provider_id}")    for provider in providers:

    print(f"  External Order ID: {order.external_order_id}")        print(f"  - {provider.id}: {provider.name} ({provider.provider})")

    print(f"  External Status: {order.external_status}")    

    print(f"  Provider Message: {order.provider_message}")    if providers.exists():

            # Test with first provider

except Exception as e:        test_provider = providers.first()

    print("\n" + "="*80)        print(f"\nTesting dispatch to provider: {test_provider.name} ({test_provider.id})")

    print("AUTO-DISPATCH FAILED")        

    print("="*80)        try:

    print(f"Error: {e}")            # This simulates what happens in the admin panel

    import traceback            print("Calling try_auto_dispatch...")

    traceback.print_exc()            try_auto_dispatch(str(order.id), str(order.tenant_id))

            

print("\n" + "="*80)            # Check result

            order.refresh_from_db()
            print(f"\nResult:")
            print(f"  Status: {order.status}")
            print(f"  Provider ID: {order.provider_id}")
            print(f"  External Order ID: {order.external_order_id}")
            print(f"  External Status: {order.external_status}")
            
            if order.provider_id and order.external_order_id:
                print("SUCCESS: Dispatch successful!")
            else:
                print("ERROR: Dispatch failed - no provider_id or external_order_id set")
                
        except Exception as e:
            print(f"ERROR: Exception during dispatch: {e}")
            import traceback
            print("Full traceback:")
            print(traceback.format_exc())
    else:
        print("ERROR: No providers available for this tenant")
else:
    print("ERROR: No pending orders found to test with")

print("\n=== TEST COMPLETE ===")
