#!/usr/bin/env python
"""Dispatch the new order"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# الطلب الجديد
order_id = '871e4ee8-2157-4b68-83a6-bc1ce6080c61'
order = ProductOrder.objects.get(id=order_id)

print(f"📦 Dispatching order: {order_id[:8]}...")
print(f"   Current Status: {order.status}\n")

# محاولة التوجيه التلقائي
try:
    result = try_auto_dispatch(order_id, str(order.tenant_id))
    print(f"\n✅ Dispatch completed!")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

# فحص النتيجة
order.refresh_from_db()
print(f"\n📊 Final Status:")
print(f"   Status: {order.status}")
print(f"   Manual Note: {order.manual_note or 'None'}")
