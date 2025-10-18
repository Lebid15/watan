"""
Dispatch الطلب E69E1F يدوياً
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.services import try_auto_dispatch

ORDER_ID = "227f9d86-be28-40c6-ae30-65689ae69e1f"
TENANT_ID = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"

print("=" * 80)
print(f"🚀 Dispatching Order E69E1F")
print("=" * 80)

try_auto_dispatch(ORDER_ID, TENANT_ID)

# فحص النتيجة
from apps.orders.models import ProductOrder

order = ProductOrder.objects.get(id=ORDER_ID)

print("\n" + "=" * 80)
print("📊 RESULT")
print("=" * 80)
print(f"   Status: {order.status}")
print(f"   Manual Note: {order.manual_note[:50] if order.manual_note else None}...")

if order.status == 'approved' and order.manual_note:
    print(f"\n✅ SUCCESS! Code: {order.manual_note}")
else:
    print(f"\n❌ FAILED!")

print("=" * 80)
