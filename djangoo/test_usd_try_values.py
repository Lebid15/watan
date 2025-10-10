import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.serializers import AdminOrderListItemSerializer

# Get the last order
o = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at').first()

print("=" * 80)
print(f"اختبار القيم بالدولار والليرة للطلب: {o.order_no or o.id}")
print("=" * 80)

# Serialize the order
serializer = AdminOrderListItemSerializer(o)
data = serializer.data

print(f"\n💵 القيم بالدولار (USD):")
print(f"  costUsdAtOrder: ${data.get('costUsdAtOrder')}")
print(f"  sellUsdAtOrder: ${data.get('sellUsdAtOrder')}")
print(f"  profitUsdAtOrder: ${data.get('profitUsdAtOrder')}")

print(f"\n💰 القيم بالليرة التركية (TRY):")
print(f"  costTRY: ₺{data.get('costTRY')}")
print(f"  sellTRY: ₺{data.get('sellTRY')}")
print(f"  profitTRY: ₺{data.get('profitTRY')}")

print("\n" + "=" * 80)
print("✅ النتيجة المتوقعة في الجدول:")
print(f"  التكلفة: ${data.get('costUsdAtOrder'):.2f} / ₺{data.get('costTRY'):.2f}")
print(f"  السعر: ${data.get('sellUsdAtOrder'):.2f} / ₺{data.get('sellTRY'):.2f}")
print(f"  الربح: ${data.get('profitUsdAtOrder'):.2f} / ₺{data.get('profitTRY'):.2f}")
print("=" * 80)
