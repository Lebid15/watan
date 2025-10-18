"""
محاولة dispatch الطلب 4ADEFA (شام تيك)
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.services import try_auto_dispatch

ORDER_SHAMTECH_ID = "d2de8004-3d98-4dfc-8d39-e3ca254adefa"  # 4ADEFA
TENANT_SHAMTECH = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"

print("=" * 100)
print("🚀 Manually Dispatching Order 4ADEFA")
print("=" * 100)

try_auto_dispatch(ORDER_SHAMTECH_ID, TENANT_SHAMTECH)

# فحص النتيجة
from apps.orders.models import ProductOrder

order = ProductOrder.objects.get(id=ORDER_SHAMTECH_ID)

print("\n" + "=" * 100)
print("📊 RESULT")
print("=" * 100)
print(f"   Status: {order.status}")
print(f"   Manual Note: {order.manual_note[:50] if order.manual_note else None}...")

if order.status == 'approved' and order.manual_note:
    print(f"\n✅ SUCCESS!")
else:
    print(f"\n❌ FAILED!")

print("=" * 100)
