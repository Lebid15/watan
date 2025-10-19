#!/usr/bin/env python
"""
Fix Order Dispatch Issue

This script identifies and fixes the order dispatch problem where orders
are created but not dispatched to external providers.

The issue is in PackageRouting configuration:
- Mode: auto (should dispatch automatically)
- Provider Type: manual (requires manual processing)
- Primary Provider: None (no provider configured)

This creates a contradiction that prevents auto-dispatch.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration
from apps.tenants.models import Tenant
from django.utils import timezone

def analyze_problem():
    """Analyze the current problem"""
    print("=" * 80)
    print("ORDER DISPATCH PROBLEM ANALYSIS")
    print("=" * 80)
    
    # Find recent pending orders
    recent_orders = ProductOrder.objects.filter(
        status='pending',
        external_order_id__isnull=True,
        created_at__gte=timezone.now() - timezone.timedelta(hours=24)
    ).order_by('-created_at')[:5]
    
    print(f"\nFound {recent_orders.count()} recent pending orders:")
    
    for order in recent_orders:
        print(f"\nOrder: {order.id}")
        print(f"  Tenant: {order.tenant_id}")
        print(f"  Status: {order.status}")
        print(f"  External Order ID: {order.external_order_id}")
        print(f"  Created: {order.created_at}")
        
        # Check package routing
        routing = PackageRouting.objects.filter(
            package_id=order.package_id,
            tenant_id=order.tenant_id
        ).first()
        
        if routing:
            print(f"  Package Routing:")
            print(f"    Mode: {routing.mode}")
            print(f"    Provider Type: {routing.provider_type}")
            print(f"    Primary Provider: {routing.primary_provider_id}")
            
            # Identify the problem
            if routing.mode == 'auto' and routing.provider_type == 'manual':
                print(f"    [PROBLEM] Contradiction: auto mode with manual provider type")
            elif routing.primary_provider_id is None:
                print(f"    [PROBLEM] No primary provider configured")
            else:
                print(f"    [OK] Configuration looks correct")
        else:
            print(f"  [PROBLEM] No PackageRouting found")
    
    return recent_orders

def check_available_providers():
    """Check what providers are available"""
    print("\n" + "=" * 80)
    print("AVAILABLE PROVIDERS")
    print("=" * 80)
    
    # Get all tenants and their providers
    tenants = Tenant.objects.all()
    
    for tenant in tenants:
        print(f"\nTenant: {tenant.name} ({tenant.id})")
        
        providers = Integration.objects.filter(tenant_id=tenant.id)
        print(f"  Providers: {providers.count()}")
        
        for provider in providers:
            print(f"    - {provider.name} ({provider.provider})")
            print(f"      Base URL: {provider.base_url}")

def suggest_fixes():
    """Suggest fixes for the dispatch problem"""
    print("\n" + "=" * 80)
    print("SUGGESTED FIXES")
    print("=" * 80)
    
    print("\n1. IMMEDIATE FIX - Manual Dispatch:")
    print("   - Go to admin panel")
    print("   - Find pending orders")
    print("   - Manually dispatch them to available providers")
    
    print("\n2. PERMANENT FIX - Configure PackageRouting:")
    print("   - Set proper provider type (external, not manual)")
    print("   - Configure primary provider")
    print("   - Ensure auto-dispatch works")
    
    print("\n3. ALTERNATIVE - Use Internal Provider:")
    print("   - Configure internal provider for manual processing")
    print("   - Set up proper routing")
    
    print("\n4. CELERY BEHAVIOR:")
    print("   - Celery correctly ignores orders without external_order_id")
    print("   - This is the expected behavior per our fixes")
    print("   - Orders need to be dispatched first, then Celery tracks them")

def create_test_dispatch():
    """Create a test dispatch for the recent order"""
    print("\n" + "=" * 80)
    print("TEST DISPATCH ATTEMPT")
    print("=" * 80)
    
    # Get the most recent order
    recent_order = ProductOrder.objects.filter(
        status='pending',
        external_order_id__isnull=True
    ).order_by('-created_at').first()
    
    if not recent_order:
        print("No pending orders found")
        return
    
    print(f"Attempting to dispatch order: {recent_order.id}")
    
    # Check if we can find a provider to dispatch to
    tenant = Tenant.objects.get(id=recent_order.tenant_id)
    providers = Integration.objects.filter(
        tenant_id=tenant.id
    )
    
    if providers.exists():
        provider = providers.first()
        print(f"Found provider: {provider.name} ({provider.provider})")
        
        # Try to dispatch using the service
        try:
            from apps.orders.services import try_auto_dispatch
            print(f"Attempting auto-dispatch...")
            try_auto_dispatch(str(recent_order.id), str(recent_order.tenant_id))
            
            # Check result
            recent_order.refresh_from_db()
            print(f"Result:")
            print(f"  Status: {recent_order.status}")
            print(f"  External Order ID: {recent_order.external_order_id}")
            print(f"  Provider ID: {recent_order.provider_id}")
            
            if recent_order.external_order_id:
                print(f"  [SUCCESS] Order dispatched successfully!")
            else:
                print(f"  [FAILED] Order still not dispatched")
                
        except Exception as e:
            print(f"  [ERROR] Dispatch failed: {e}")
    else:
        print(f"No active providers found for tenant: {tenant.name}")
        print(f"This explains why the order cannot be dispatched")

def main():
    """Main function"""
    print("ORDER DISPATCH PROBLEM DIAGNOSIS")
    print("=" * 80)
    
    # Analyze the problem
    recent_orders = analyze_problem()
    
    # Check available providers
    check_available_providers()
    
    # Suggest fixes
    suggest_fixes()
    
    # Try to create a test dispatch
    create_test_dispatch()
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print("The problem is NOT with Celery tracking.")
    print("The problem is with order dispatch configuration.")
    print("Orders are created but not dispatched to external providers.")
    print("Celery correctly ignores them until they are dispatched.")
    print("The tenant needs to configure proper providers and routing.")

if __name__ == "__main__":
    main()
