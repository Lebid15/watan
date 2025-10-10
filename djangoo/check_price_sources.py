import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import PackagePrice, ProductPackage
from apps.users.models import User as DjangoUser
from decimal import Decimal

# Get the last order
o = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at').first()

print("=" * 80)
print(f"فحص مصادر الأسعار للطلب: {o.order_no or o.id}")
print("=" * 80)

# Get the package details
if o.package:
    pkg = ProductPackage.objects.get(id=o.package_id)
    print(f"\n📦 الباقة: {pkg.name}")
    print(f"   Package ID: {pkg.id}")
    print(f"   base_price: {getattr(pkg, 'base_price', 'N/A')}")
    print(f"   capital: {getattr(pkg, 'capital', 'N/A')}")
    print(f"   price: {getattr(pkg, 'price', 'N/A')}")

# Get ALL package prices for this package
print(f"\n💰 جميع الأسعار في package_prices لهذه الباقة:")
all_prices = PackagePrice.objects.filter(
    package_id=o.package_id,
    tenant_id=o.tenant_id
)

for pp in all_prices:
    from apps.products.models import PriceGroup
    pg = PriceGroup.objects.filter(id=pp.price_group_id).first()
    pg_name = pg.name if pg else "N/A"
    print(f"   - مجموعة الأسعار: {pg_name} (ID: {pp.price_group_id})")
    print(f"     السعر: {pp.price} USD")

# Get user's price group
price_group_id = None
if o.user:
    price_group_id = getattr(o.user, 'price_group_id', None)
    if not price_group_id:
        user_email = getattr(o.user, 'email', None)
        if user_email:
            dj_user = DjangoUser.objects.filter(email=user_email, tenant_id=o.tenant_id).first()
            if dj_user:
                price_group_id = getattr(dj_user, 'price_group_id', None)

if price_group_id:
    from apps.products.models import PriceGroup
    pg = PriceGroup.objects.filter(id=price_group_id).first()
    print(f"\n👤 مجموعة أسعار المستخدم: {pg.name if pg else 'N/A'}")
    print(f"   ID: {price_group_id}")

print("\n" + "=" * 80)
print("❓ السؤال: أي سعر يُستخدم كتكلفة (cost)؟")
print("   الخيار 1: base_price أو capital من product_packages؟")
print("   الخيار 2: سعر من package_prices لمجموعة معينة؟")
print("=" * 80)
