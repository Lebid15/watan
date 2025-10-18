#!/usr/bin/env python
"""Re-trigger auto-dispatch for existing order"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch

# الطلب الأخير
order_id = '9446977e-11d6-4019-91bc-a8b5faa07fe0'
order = ProductOrder.objects.get(id=order_id)

print(f"📦 Triggering auto-dispatch for order: {order_id[:8]}...")
print(f"   Package: {order.package_id}")
print(f"   Current Status: {order.status}")
print(f"   Current Provider: {order.provider_id or 'None'}")

# محاولة التوجيه التلقائي (تمرير order_id كـ string)
try:
    result = try_auto_dispatch(order_id, str(order.tenant_id))
    print(f"\n✅ Result: {result}")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

# فحص الحالة بعد المحاولة
order.refresh_from_db()
print(f"\n📊 After dispatch:")
print(f"   Status: {order.status}")
print(f"   Provider: {order.provider_id or 'None'}")
print(f"   External Order: {order.external_order_id or 'None'}")
print(f"   Manual Note: {order.manual_note or 'None'}")
