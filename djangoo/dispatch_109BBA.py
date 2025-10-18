#!/usr/bin/env python
"""Dispatch order 109BBA"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# الطلب
order_id = '5987bd40-f280-4fd1-907b-f8cda3109bba'
order = ProductOrder.objects.get(id=order_id)

print(f"📦 Attempting to dispatch order: {order_id[-6:].upper()}")
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
