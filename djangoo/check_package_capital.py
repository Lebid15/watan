import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import ProductPackage

# Find ahla 400 and ahla 300 packages
packages = ProductPackage.objects.filter(name__icontains='ahla').order_by('name')

print("=" * 80)
print("فحص حقول base_price و capital في باقات Ahla:")
print("=" * 80)

for pkg in packages:
    print(f"\n📦 {pkg.name}")
    print(f"   ID: {pkg.id}")
    print(f"   base_price: {pkg.base_price}")
    print(f"   capital: {pkg.capital}")

print("\n" + "=" * 80)
print("من الجدول في الصورة:")
print("  ahla 300 → رأس المال: 0.70")
print("  ahla 400 → رأس المال: 1.00")
print("=" * 80)
