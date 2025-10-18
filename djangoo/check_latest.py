#!/usr/bin/env python
"""Check latest order"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting

# آخر طلب
order = ProductOrder.objects.order_by('-created_at').first()

print(f"📦 Latest Order:")
print(f"  ID: {order.id}")
print(f"  Package ID: {order.package_id}")
print(f"  Status: {order.status}")
print(f"  Provider ID: {order.provider_id or 'None'}")
print(f"  External Order ID: {order.external_order_id or 'None'}")
print(f"  Manual Note: {order.manual_note or 'None'}")
print(f"  Created: {order.created_at}")

# فحص التوجيه
print(f"\n🔍 Routing Config:")
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=order.tenant_id
).first()

if routing:
    print(f"  ✅ Mode: {routing.mode}")
    print(f"  ✅ Provider Type: {routing.provider_type}")
    print(f"  ✅ Code Group ID: {routing.code_group_id}")
else:
    print(f"  ❌ No routing found!")
