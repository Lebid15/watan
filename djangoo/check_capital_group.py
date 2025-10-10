import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import PriceGroup, PackagePrice

# Get all price groups for the tenant
tenant_id = 'f4432532-cc0c-4af8-88a6-de2013e6ec7a'  # Example, will find from order

from apps.orders.models import ProductOrder
o = ProductOrder.objects.select_related('user', 'package').first()

if o:
    tenant_id = o.tenant_id
    package_id = o.package_id
    
    print("=" * 80)
    print("مجموعات الأسعار (Price Groups):")
    print("=" * 80)
    
    price_groups = PriceGroup.objects.filter(tenant_id=tenant_id, is_active=True)
    for pg in price_groups:
        print(f"\n📊 {pg.name}")
        print(f"   ID: {pg.id}")
        print(f"   Active: {pg.is_active}")
        
        # Get price for our test package
        pkg_price = PackagePrice.objects.filter(
            package_id=package_id,
            price_group_id=pg.id,
            tenant_id=tenant_id
        ).first()
        
        if pkg_price:
            print(f"   سعر الباقة {o.package.name if o.package else 'N/A'}: {pkg_price.price} USD")
    
    print("\n" + "=" * 80)
    print("❓ أي مجموعة تُستخدم كمجموعة رأس المال (Capital/Cost)?")
    print("=" * 80)
