import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.products.models import PackagePrice
from apps.users.models import User as DjangoUser

# Get the order with ID from the screenshot (you mentioned A76528)
# Let's find orders and show the last one
orders = ProductOrder.objects.select_related('user', 'package', 'product').order_by('-created_at')[:5]

for o in orders:
    print("=" * 80)
    print(f"رقم الطلب: {o.order_no or o.id}")
    print(f"ID: {o.id}")
    print(f"الحالة: {o.status}")
    print("-" * 80)
    
    # User info
    if o.user:
        print(f"المستخدم (من users): {o.user.username or o.user.email}")
        print(f"  - ID: {o.user.id}")
        print(f"  - Email: {o.user.email}")
        print(f"  - Username: {o.user.username}")
        print(f"  - price_group_id: {getattr(o.user, 'price_group_id', None)}")
        
        # Check DjangoUser
        user_email = getattr(o.user, 'email', None)
        if user_email:
            dj_user = DjangoUser.objects.filter(email=user_email, tenant_id=o.tenant_id).first()
            if dj_user:
                print(f"\nالمستخدم (من dj_users):")
                print(f"  - ID: {dj_user.id}")
                print(f"  - Email: {dj_user.email}")
                print(f"  - price_group_id: {getattr(dj_user, 'price_group_id', None)}")
    else:
        print("المستخدم: لا يوجد")
    
    print("-" * 80)
    
    # Package info
    if o.package:
        print(f"الباقة: {o.package.name}")
        print(f"  - ID: {o.package.id}")
    else:
        print("الباقة: لا يوجد")
    
    # Product info
    if o.product:
        print(f"المنتج: {o.product.name}")
    
    print("-" * 80)
    
    # Financial info
    print(f"الكمية: {o.quantity}")
    print(f"سعر البيع: {o.sell_price_amount} {o.sell_price_currency}")
    print(f"السعر (price): {o.price}")
    
    # Get cost from PackagePrice
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
            unit_cost = float(pkg_price.price)
            total_cost = unit_cost * o.quantity
            print(f"التكلفة (من PackagePrice):")
            print(f"  - سعر الوحدة: {unit_cost}")
            print(f"  - التكلفة الإجمالية: {total_cost}")
            print(f"  - مجموعة الأسعار: {price_group_id}")
            
            # Calculate profit
            if o.sell_price_currency == 'USD':
                profit = float(o.sell_price_amount) - total_cost
                print(f"  - الربح: {profit} USD")
        else:
            print("التكلفة: لم يتم العثور على سعر في PackagePrice")
    else:
        print("التكلفة: لا يمكن حسابها (لا توجد مجموعة أسعار أو باقة)")
    
    print("-" * 80)
    print(f"userIdentifier: {o.user_identifier}")
    print(f"extraField: {o.extra_field}")
    print(f"providerId: {o.provider_id}")
    print(f"providerType: {'external' if o.provider_id else 'manual'}")
    print(f"تاريخ الإنشاء: {o.created_at}")
    print("=" * 80)
    print("\n")
