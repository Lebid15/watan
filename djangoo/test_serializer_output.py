import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.serializers import AdminOrderListItemSerializer

# Get the last order
o = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at').first()

print("=" * 80)
print(f"اختبار الـ Serializer للطلب: {o.order_no or o.id}")
print("=" * 80)

# Serialize the order
serializer = AdminOrderListItemSerializer(o)
data = serializer.data

print(f"\nالبيانات المُرجعة من الـ Serializer:")
print(f"  costTRY: {data.get('costTRY')}")
print(f"  sellTRY: {data.get('sellTRY')}")
print(f"  profitTRY: {data.get('profitTRY')}")
print(f"  currencyTRY: {data.get('currencyTRY')}")
print(f"  username: {data.get('username')}")
print(f"  userEmail: {data.get('userEmail')}")

print("\n" + "=" * 80)
if data.get('costTRY') is None:
    print("⚠️ التكلفة None - يجب فحص الأخطاء في logs")
else:
    print(f"✅ التكلفة: ₺{data.get('costTRY'):.2f}")

if data.get('sellTRY') is None:
    print("⚠️ السعر None - يجب فحص الأخطاء في logs")
else:
    print(f"✅ السعر: ₺{data.get('sellTRY'):.2f}")

if data.get('profitTRY') is None:
    print("⚠️ الربح None")
else:
    print(f"✅ الربح: ₺{data.get('profitTRY'):.2f}")

print("=" * 80)
