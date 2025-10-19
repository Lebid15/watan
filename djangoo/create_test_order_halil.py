"""
إنشاء طلب تجريبي جديد من المستخدم halil في alsham
للباقة: pubg global 180

الهدف: اختبار السيناريو (1) - معالجة يدوية داخل نفس المستأجر
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from apps.orders.models import ProductOrder
from apps.users.legacy_models import LegacyUser
from apps.products.models import ProductPackage
from apps.providers.models import PackageRouting
from decimal import Decimal
import uuid

# معرفات البيانات
ALSHAM_TENANT_ID = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
HALIL_USER_ID = "7a73edd8-183f-4fbd-a07b-6863b3f6b842"
PUBG_GLOBAL_180_PACKAGE_ID = "36f2e41d-62ce-46d1-b1a7-9ac8e9cf4057"

print("=" * 100)
print("📦 إنشاء طلب تجريبي جديد من halil في alsham")
print("=" * 100)

# ============================================================================
# Step 1: التحقق من المستخدم والباقة
# ============================================================================
print("\n[Step 1] التحقق من المستخدم والباقة...")

try:
    user = LegacyUser.objects.get(id=HALIL_USER_ID, tenant_id=ALSHAM_TENANT_ID)
    print(f"✅ المستخدم موجود:")
    print(f"   - Username: {user.username}")
    print(f"   - Email: {user.email}")
    print(f"   - Balance: {user.balance or 0}")
    print(f"   - Overdraft Limit: {user.overdraft_limit or 0}")
except LegacyUser.DoesNotExist:
    print(f"❌ المستخدم غير موجود!")
    sys.exit(1)

try:
    package = ProductPackage.objects.select_related('product').get(
        id=PUBG_GLOBAL_180_PACKAGE_ID,
        tenant_id=ALSHAM_TENANT_ID
    )
    print(f"\n✅ الباقة موجودة:")
    print(f"   - Name: {package.name}")
    print(f"   - Product: {package.product.name if package.product else 'N/A'}")
    print(f"   - Base Price: ${package.base_price or package.capital or 0}")
except ProductPackage.DoesNotExist:
    print(f"❌ الباقة غير موجودة!")
    sys.exit(1)

# ============================================================================
# Step 2: التحقق من إعدادات التوجيه
# ============================================================================
print("\n[Step 2] التحقق من إعدادات التوجيه (PackageRouting)...")

try:
    routing = PackageRouting.objects.get(
        package_id=PUBG_GLOBAL_180_PACKAGE_ID,
        tenant_id=ALSHAM_TENANT_ID
    )
    print(f"✅ PackageRouting موجود:")
    print(f"   - Mode: {routing.mode}")
    print(f"   - Provider Type: {routing.provider_type}")
    print(f"   - Primary Provider: {routing.primary_provider_id or 'لا يوجد'}")
    
    if routing.mode != 'manual':
        print(f"\n⚠️  تحذير: الوضع ليس 'manual' (هو '{routing.mode}')")
        print(f"   هذا قد يؤدي إلى توجيه تلقائي!")
    else:
        print(f"\n✅ الوضع = 'manual' - لن يتم التوجيه التلقائي")
        
except PackageRouting.DoesNotExist:
    print(f"⚠️  لا يوجد PackageRouting - سيتم اعتبار الطلب Manual افتراضياً")
    routing = None

# ============================================================================
# Step 3: إنشاء الطلب
# ============================================================================
print("\n[Step 3] إنشاء الطلب الجديد...")

# حساب السعر
quantity = 1
unit_price = Decimal(str(package.base_price or package.capital or 3.0))
total_price = unit_price * quantity

print(f"\n💰 تفاصيل السعر:")
print(f"   - Unit Price: ${unit_price}")
print(f"   - Quantity: {quantity}")
print(f"   - Total Price: ${total_price}")

# بيانات الطلب
order_data = {
    'user_identifier': '123456789',  # مثال على معرف اللاعب
    'extra_field': 'Server1',  # مثال على السيرفر
}

print(f"\n📝 بيانات الطلب:")
print(f"   - User Identifier: {order_data['user_identifier']}")
print(f"   - Extra Field: {order_data['extra_field']}")

# إنشاء الطلب في معاملة واحدة
with transaction.atomic():
    # قفل المستخدم للتحديث
    user_locked = LegacyUser.objects.select_for_update().get(id=HALIL_USER_ID)
    
    # التحقق من الرصيد
    available_balance = Decimal(user_locked.balance or 0) + Decimal(user_locked.overdraft_limit or 0)
    print(f"\n💳 فحص الرصيد:")
    print(f"   - Current Balance: {user_locked.balance or 0}")
    print(f"   - Overdraft Limit: {user_locked.overdraft_limit or 0}")
    print(f"   - Available Balance: {available_balance}")
    print(f"   - Required: {total_price}")
    
    if total_price > available_balance:
        print(f"\n❌ الرصيد غير كافٍ!")
        print(f"   المطلوب: ${total_price}")
        print(f"   المتاح: ${available_balance}")
        sys.exit(1)
    
    print(f"   ✅ الرصيد كافٍ")
    
    # خصم المبلغ من رصيد المستخدم
    new_balance = Decimal(user_locked.balance or 0) - total_price
    user_locked.balance = new_balance
    user_locked.save(update_fields=['balance'])
    
    print(f"\n💸 تحديث الرصيد:")
    print(f"   - Balance Before: {Decimal(user_locked.balance or 0) + total_price}")
    print(f"   - Amount Deducted: ${total_price}")
    print(f"   - Balance After: {new_balance}")
    
    # إنشاء الطلب
    order = ProductOrder.objects.create(
        id=uuid.uuid4(),
        tenant_id=ALSHAM_TENANT_ID,
        user_id=user_locked.id,
        product_id=package.product_id,
        package_id=package.id,
        quantity=quantity,
        status='pending',
        mode='MANUAL',  # تعيين الوضع صراحة
        price=total_price,
        sell_price_currency='USD',
        sell_price_amount=total_price,
        created_at=timezone.now(),
        user_identifier=order_data['user_identifier'],
        extra_field=order_data['extra_field'],
        external_status='not_sent',
        provider_id=None,  # لا يوجد مزود
        external_order_id=None,  # لا يوجد معرف خارجي
        notes=[],
        notes_count=0,
    )
    
    print(f"\n✅ تم إنشاء الطلب بنجاح!")
    print(f"   - Order ID: {order.id}")
    print(f"   - Order Short ID: {str(order.id)[-6:].upper()}")

# ============================================================================
# Step 4: طباعة معلومات الطلب النهائية
# ============================================================================
print("\n" + "=" * 100)
print("📊 معلومات الطلب النهائية في الشام (alsham)")
print("=" * 100)

# إعادة تحميل الطلب للحصول على أحدث البيانات
order = ProductOrder.objects.select_related('user', 'package', 'product').get(id=order.id)

print(f"\n🎫 معلومات الطلب:")
print(f"   - Order ID: {order.id}")
print(f"   - Order Short ID: {str(order.id)[-6:].upper()}")
print(f"   - Created At: {order.created_at}")

print(f"\n👤 المستخدم:")
print(f"   - Username: {order.user.username if order.user else 'N/A'}")
print(f"   - Email: {order.user.email if order.user else 'N/A'}")

print(f"\n📦 المنتج والباقة:")
print(f"   - Product: {order.product.name if order.product else 'N/A'}")
print(f"   - Package: {order.package.name if order.package else 'N/A'}")
print(f"   - Quantity: {order.quantity}")

print(f"\n💰 السعر:")
print(f"   - Unit Price: ${unit_price}")
print(f"   - Total Price: ${order.price}")
print(f"   - Currency: {order.sell_price_currency}")

print(f"\n🎮 بيانات الطلب:")
print(f"   - User Identifier: {order.user_identifier}")
print(f"   - Extra Field: {order.extra_field}")

print(f"\n📍 حالة الطلب:")
print(f"   - Status: {order.status}")
print(f"   - Mode: {order.mode}")
print(f"   - External Status: {order.external_status}")

print(f"\n🔗 معلومات التوجيه:")
print(f"   - Provider ID: {order.provider_id or 'لا يوجد (Manual ✅)'}")
print(f"   - External Order ID: {order.external_order_id or 'لا يوجد (Manual ✅)'}")
print(f"   - Provider Message: {order.provider_message or 'لا يوجد'}")

print(f"\n📝 ملاحظات:")
print(f"   - Manual Note: {order.manual_note or 'لا يوجد'}")
print(f"   - Notes Count: {order.notes_count or 0}")

print("\n" + "=" * 100)
print("✅ تم إنشاء الطلب بنجاح!")
print("=" * 100)

print("\n🎯 الخطوات التالية:")
print("1. افتح لوحة المشرف في alsham")
print(f"2. ابحث عن الطلب برقم: {str(order.id)[-6:].upper()}")
print("3. تحقق من:")
print("   ✓ يظهر بوضع 'Manual'")
print("   ✓ لا يوجد معلومات توجيه خارجي (provider/routed)")
print("   ✓ يظهر إشعار للمشرف بوجود طلب جديد")
print("   ✓ الحالة 'pending' وينتظر المعالجة اليدوية")

print(f"\n🔍 للتحقق من الإعدادات:")
print(f"   python check_order_details.py {order.id}")
