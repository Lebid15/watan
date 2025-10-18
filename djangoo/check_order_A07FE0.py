#!/usr/bin/env python
"""Check specific order by order number"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting

# البحث عن الطلب
order = ProductOrder.objects.filter(order_no__icontains='A07FE0').first()
if not order:
    print("❌ Order not found with number A07FE0")
    # البحث في آخر 5 طلبات
    print("\nLast 5 orders:")
    for o in ProductOrder.objects.order_by('-created_at')[:5]:
        print(f"  - Order No: {o.order_no or 'N/A'} | ID: {str(o.id)[:8]}... | Status: {o.status}")
else:
    print(f"📦 Order Found:")
    print(f"  Order No: {order.order_no}")
    print(f"  ID: {order.id}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id or 'None'}")
    print(f"  External Order ID: {order.external_order_id or 'None'}")
    print(f"  Manual Note: {order.manual_note or 'None'}")
    print(f"  Created: {order.created_at}")
    
    # فحص التوجيه
    print(f"\n🔍 Checking Routing Config:")
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    ).first()
    
    if routing:
        print(f"  ✅ Routing found!")
        print(f"     Mode: {routing.mode}")
        print(f"     Provider Type: {routing.provider_type}")
        print(f"     Code Group ID: {routing.code_group_id}")
    else:
        print(f"  ❌ No routing configured for this package!")
