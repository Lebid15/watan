import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import PackagePrice

# Get first order
o = ProductOrder.objects.select_related('user', 'package').first()

if not o:
    print("No orders found")
    exit()

print(f"Order ID: {o.id}")
print(f"Package ID: {o.package_id}")
print(f"User: {o.user}")
print(f"User ID: {o.user.id if o.user else None}")

if o.user:
    price_group_id = getattr(o.user, 'price_group_id', None)
    print(f"User price_group_id (from LegacyUser): {price_group_id}")
    
    # Check DjangoUser table using email or username
    from apps.users.models import User as DjangoUser
    
    if not price_group_id:
        print("\n⚠️ المستخدم في جدول users ليس لديه price_group_id!")
        print("Searching in dj_users table...")
        
        # Try to find in DjangoUser by email
        user_email = getattr(o.user, 'email', None)
        user_username = getattr(o.user, 'username', None)
        
        django_user = None
        if user_email:
            django_user = DjangoUser.objects.filter(email=user_email, tenant_id=o.tenant_id).first()
        
        if not django_user and user_username:
            django_user = DjangoUser.objects.filter(username=user_username, tenant_id=o.tenant_id).first()
        
        if django_user:
            dj_price_group_id = getattr(django_user, 'price_group_id', None)
            print(f"Found in DjangoUser (dj_users) table:")
            print(f"  - User ID: {django_user.id}")
            print(f"  - Email: {django_user.email}")
            print(f"  - price_group_id: {dj_price_group_id}")
            
            if dj_price_group_id:
                price_group_id = dj_price_group_id
                print(f"\n✅ Will use price_group_id from DjangoUser: {price_group_id}")
        else:
            print("⚠️ User not found in dj_users table either!")
    
    if price_group_id:
        print(f"\n🔍 Looking for PackagePrice with price_group_id={price_group_id}")
        if o.package_id:
            specific_price = PackagePrice.objects.filter(
                package_id=o.package_id,
                price_group_id=price_group_id,
                tenant_id=o.tenant_id
            ).first()
            
            if specific_price:
                print(f"✅ Found matching price: {specific_price.price}")
            else:
                print(f"⚠️ No price found for this price_group_id!")
else:
    print("\n⚠️ الطلب ليس له مستخدم!")

if o.package_id:
    print(f"\nSearching PackagePrice for package_id={o.package_id}, tenant_id={o.tenant_id}")
    prices = PackagePrice.objects.filter(package_id=o.package_id, tenant_id=o.tenant_id)
    print(f"PackagePrices count: {prices.count()}")
    
    for p in prices[:10]:
        print(f"  - PriceGroup: {p.price_group_id}, Price: {p.price}")
else:
    print("\n⚠️ الطلب ليس له package_id!")
