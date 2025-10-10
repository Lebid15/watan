import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import PackagePrice
from apps.users.models import User as DjangoUser
from apps.currencies.models import Currency
from decimal import Decimal

# Get the last order
o = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at').first()

print("=" * 80)
print(f"اختبار حساب التكلفة والربح للطلب: {o.order_no or o.id}")
print("=" * 80)

# Get exchange rate
currency = Currency.objects.filter(
    tenant_id=o.tenant_id,
    code__iexact='TRY',
    is_active=True
).first()

if currency:
    print(f"\n💱 سعر الصرف (USD → TRY): {currency.rate}")
    exchange_rate = Decimal(str(currency.rate))
else:
    print(f"\n⚠️ لم يتم العثور على سعر صرف TRY، سيتم استخدام 1")
    exchange_rate = Decimal('1')

# Get price_group_id
price_group_id = None
if o.user:
    price_group_id = getattr(o.user, 'price_group_id', None)
    if not price_group_id:
        user_email = getattr(o.user, 'email', None)
        if user_email:
            dj_user = DjangoUser.objects.filter(email=user_email, tenant_id=o.tenant_id).first()
            if dj_user:
                price_group_id = getattr(dj_user, 'price_group_id', None)

if price_group_id and o.package_id:
    pkg_price = PackagePrice.objects.filter(
        package_id=o.package_id,
        price_group_id=price_group_id,
        tenant_id=o.tenant_id
    ).first()
    
    if pkg_price:
        print(f"\n📦 معلومات الباقة: {o.package.name if o.package else 'N/A'}")
        print(f"   الكمية: {o.quantity}")
        
        # Cost calculation
        unit_cost_usd = Decimal(str(pkg_price.price))
        total_cost_usd = unit_cost_usd * o.quantity
        total_cost_try = total_cost_usd * exchange_rate
        
        print(f"\n💰 التكلفة:")
        print(f"   سعر الوحدة (USD): ${unit_cost_usd}")
        print(f"   التكلفة الإجمالية (USD): ${total_cost_usd}")
        print(f"   التكلفة الإجمالية (TRY): ₺{total_cost_try:.2f}")
        
        # Sell price
        print(f"\n💵 سعر البيع:")
        print(f"   المبلغ: {o.sell_price_amount} {o.sell_price_currency}")
        
        sell_try = None
        if o.sell_price_currency == 'TRY':
            sell_try = Decimal(str(o.sell_price_amount))
            print(f"   بالليرة: ₺{sell_try:.2f}")
        elif o.sell_price_currency == 'USD':
            sell_usd = Decimal(str(o.sell_price_amount))
            sell_try = sell_usd * exchange_rate
            print(f"   بالدولار: ${sell_usd}")
            print(f"   بالليرة: ₺{sell_try:.2f}")
        
        # Profit
        if sell_try:
            profit_try = sell_try - total_cost_try
            print(f"\n📊 الربح:")
            print(f"   الربح (TRY): ₺{profit_try:.2f}")
            print(f"   نسبة الربح: {(profit_try / sell_try * 100):.2f}%")
        
        print("\n" + "=" * 80)
        print("✅ الملخص:")
        print(f"   التكلفة: ₺{total_cost_try:.2f}")
        print(f"   السعر: ₺{sell_try:.2f}" if sell_try else f"   السعر: {o.sell_price_amount} {o.sell_price_currency}")
        print(f"   الربح: ₺{profit_try:.2f}" if sell_try else "   الربح: لا يمكن حسابه")
        print("=" * 80)
