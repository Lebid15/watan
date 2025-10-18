#!/usr/bin/env python
"""Dispatch order D2EF76"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# الطلب
order_id = '8f8c979d-b9f3-4fda-8bd3-2e860fd2ef76'
order = ProductOrder.objects.get(id=order_id)

print(f"📦 Attempting to dispatch order: D2EF76")
print(f"   Full ID: {order_id}")
print(f"   Current Status: {order.status}")
print(f"   Provider ID: {order.provider_id or 'None'}")
print(f"   External Order ID: {order.external_order_id or 'None'}")
print()

# محاولة التوجيه
try:
    result = try_auto_dispatch(order_id, str(order.tenant_id))
    print(f"\n✅ Dispatch attempt completed")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

# فحص النتيجة
order.refresh_from_db()
print(f"\n📊 Final State:")
print(f"   Status: {order.status}")
print(f"   Provider ID: {order.provider_id or 'None'}")
print(f"   External Order ID: {order.external_order_id or 'None'}")
print(f"   Manual Note: {order.manual_note or 'None'}")
