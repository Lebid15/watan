#!/usr/bin/env python
"""
Script to check Order 704FEC details
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration
from django.db import connection

def check_order():
    print("=" * 80)
    print("🔍 CHECKING ORDER 704FEC")
    print("=" * 80)
    
    # Get the order (use full UUID)
    order = ProductOrder.objects.select_related(
        'user', 'product', 'package', 'root_order'
    ).filter(id='60b33ccf-d50d-4dab-b46c-2feb11704fec').first()
    
    if not order:
        print("❌ Order not found!")
        return
    
    print(f"\n📦 ORDER DETAILS:")
    print(f"  ID: {order.id}")
    print(f"  User: {order.user.username if order.user else None}")
    print(f"  Package: {order.package.name if order.package else None}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Tenant ID: {order.tenant_id}")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  Status: {order.status}")
    print(f"  Mode: {order.mode}")
    print(f"  Cost Source: {order.cost_source}")
    print(f"  External Status: {order.external_status}")
    print(f"  Created: {order.created_at}")
    
    # Check all routings for this package
    print(f"\n🔀 PACKAGE ROUTINGS:")
    routings = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    )
    
    print(f"  Found {routings.count()} routing(s)")
    for i, routing in enumerate(routings, 1):
        print(f"\n  Routing #{i}:")
        print(f"    ID: {routing.id}")
        print(f"    Mode: {routing.mode}")
        print(f"    Provider Type: {routing.provider_type}")
        print(f"    Primary Provider ID: {routing.primary_provider_id}")
        print(f"    Code Group ID: {routing.code_group_id}")
        
        # Get provider name separately
        if routing.primary_provider_id:
            try:
                provider = Integration.objects.get(id=routing.primary_provider_id)
                print(f"    Primary Provider: {provider.name}")
            except:
                print(f"    Primary Provider: NOT FOUND")
    
    # Check diana integration
    print(f"\n🔍 DIANA INTEGRATION:")
    diana = Integration.objects.filter(name='diana').first()
    if diana:
        print(f"  ID: {diana.id}")
        print(f"  Name: {diana.name}")
        print(f"  Provider: {diana.provider}")
        print(f"  Scope: {diana.scope}")
        print(f"  Tenant ID: {diana.tenant_id}")
    else:
        print("  ❌ Not found!")
    
    # Check alayaZnet integration
    print(f"\n🔍 ALAYAZNET INTEGRATION:")
    alayaznet = Integration.objects.filter(name='alayaZnet').first()
    if alayaznet:
        print(f"  ID: {alayaznet.id}")
        print(f"  Name: {alayaznet.name}")
        print(f"  Provider: {alayaznet.provider}")
        print(f"  Scope: {alayaznet.scope}")
        print(f"  Tenant ID: {alayaznet.tenant_id}")
    else:
        print("  ❌ Not found!")
    
    # Skip forwarded orders check (table may not exist)
    
    # Check dispatch logs
    print(f"\n📝 DISPATCH LOGS:")
    from apps.orders.models import OrderDispatchLog
    dispatch_logs = OrderDispatchLog.objects.filter(
        order_id=order.id
    ).order_by('created_at')
    
    if dispatch_logs.exists():
        for log in dispatch_logs:
            print(f"\n  Log ID: {log.id}")
            print(f"    Action: {log.action}")
            print(f"    Result: {log.result}")
            print(f"    Message: {log.message}")
            print(f"    Created: {log.created_at}")
            if log.payload_snapshot:
                print(f"    Payload Snapshot:")
                import json
                print(f"      {json.dumps(log.payload_snapshot, indent=6, ensure_ascii=False)}")
    else:
        print("  ℹ️ No dispatch logs found")
    
    print("\n" + "=" * 80)

if __name__ == '__main__':
    check_order()
