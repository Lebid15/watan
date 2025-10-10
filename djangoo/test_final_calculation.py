import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.currencies.models import Currency
from decimal import Decimal

# Get the last order (ahla 400)
o = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at').first()

print("=" * 80)
print(f"اختبار الحسابات الجديدة للطلب: {o.order_no or o.id}")
print("=" * 80)

# Get exchange rate
currency = Currency.objects.filter(
    tenant_id=o.tenant_id,
    code__iexact='TRY',
    is_active=True
).first()

exchange_rate = Decimal(str(currency.rate)) if currency else Decimal('1')
print(f"\n💱 سعر الصرف: {exchange_rate}")

# Package info
if o.package:
    from apps.products.models import ProductPackage
    pkg = ProductPackage.objects.get(id=o.package_id)
    capital = pkg.capital or pkg.base_price
    print(f"\n📦 الباقة: {pkg.name}")
    print(f"   capital (رأس المال): ${capital}")
    print(f"   الكمية: {o.quantity}")

# Cost calculation
if o.package:
    capital_usd = Decimal(str(capital))
    total_cost_usd = capital_usd * o.quantity
    total_cost_try = total_cost_usd * exchange_rate
    
    print(f"\n💰 التكلفة:")
    print(f"   بالدولار: ${total_cost_usd}")
    print(f"   بالليرة: ₺{total_cost_try:.2f}")

# Sell price
sell_usd = Decimal(str(o.sell_price_amount))
if o.sell_price_currency == 'USD':
    sell_try = sell_usd * exchange_rate
    print(f"\n💵 السعر (البيع):")
    print(f"   بالدولار: ${sell_usd}")
    print(f"   بالليرة: ₺{sell_try:.2f}")
elif o.sell_price_currency == 'TRY':
    sell_try = sell_usd
    print(f"\n💵 السعر (البيع):")
    print(f"   بالليرة: ₺{sell_try:.2f}")

# Profit
if o.package:
    profit_try = sell_try - total_cost_try
    print(f"\n📊 الربح:")
    print(f"   بالليرة: ₺{profit_try:.2f}")
    print(f"   نسبة الربح: {(profit_try / sell_try * 100):.1f}%")

print("\n" + "=" * 80)
print("✅ النتيجة المتوقعة في الجدول:")
print(f"   التكلفة: ₺{total_cost_try:.2f}")
print(f"   السعر: ₺{sell_try:.2f}")
print(f"   الربح: ₺{profit_try:.2f}")
print("=" * 80)
