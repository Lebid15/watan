import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import PriceGroup, PackagePrice, ProductPackage

# Find ahla 400 package
package = ProductPackage.objects.filter(name__icontains='ahla 400').first()

if package:
    print("=" * 80)
    print(f"الباقة: {package.name}")
    print(f"ID: {package.id}")
    print("=" * 80)
    
    # Get all prices for this package
    prices = PackagePrice.objects.filter(package_id=package.id).select_related('price_group')
    
    print("\nجميع الأسعار لهذه الباقة:")
    for pp in prices:
        pg = pp.price_group
        print(f"\n  📊 {pg.name}")
        print(f"     Price Group ID: {pg.id}")
        print(f"     السعر: ${pp.price}")
    
    print("\n" + "=" * 80)
    print("من الصورة نرى:")
    print("  - 3.00 USD")
    print("  - 2.00 USD") 
    print("  - 1.00 USD (رأس المال)")
    print("=" * 80)
else:
    print("⚠️ لم يتم العثور على الباقة ahla 400")
