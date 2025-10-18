#!/usr/bin/env python
"""Manually dispatch order 52FA70"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

order_id = '7840a9cc-5a8f-4ebd-be4a-ef0d8e52fa70'
order = ProductOrder.objects.get(id=order_id)

print(f"📦 Manually dispatching order 52FA70")
print(f"   Status before: {order.status}")
print(f"   Provider before: {order.provider_id or 'None'}")
print(f"   Manual Note before: {order.manual_note or 'None'}")
print()

try:
    result = try_auto_dispatch(order_id, str(order.tenant_id))
    print(f"\n✅ Dispatch completed")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

order.refresh_from_db()
print(f"\n📊 After dispatch:")
print(f"   Status: {order.status}")
print(f"   Provider: {order.provider_id or 'None'}")
print(f"   Manual Note: {order.manual_note or 'None'}")
