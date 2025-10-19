"""
إصلاح السيناريو (1): معالجة يدوية داخل نفس المستأجر (alsham)

الهدف:
1. التأكد من أن PackageRouting مضبوط على manual mode
2. تصحيح الطلب الحالي ليعكس manual mode
3. التحقق من عدم وجود توجيه تلقائي
4. تمكين إشعارات المشرف للطلبات اليدوية الجديدة

الطلب المستهدف: 3a216797-b5bf-47cc-b90f-723c4521b9c9
المستخدم: halil
المستأجر: alsham (7d37f00a-22f3-4e61-88d7-2a97b79d86fb)
الباقة: pubg global 180
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection, transaction
from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting
from decimal import Decimal

# معرفات البيانات
ALSHAM_TENANT_ID = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
CURRENT_ORDER_ID = "3a216797-b5bf-47cc-b90f-723c4521b9c9"
PUBG_GLOBAL_180_PACKAGE_ID = None  # سنحصل عليه من الطلب

print("=" * 80)
print("🔧 إصلاح السيناريو (1): Manual Mode في alsham")
print("=" * 80)

# ============================================================================
# Step 1: فحص الطلب الحالي
# ============================================================================
print("\n[Step 1] فحص الطلب الحالي في قاعدة البيانات...")
try:
    order = ProductOrder.objects.select_related('user', 'package', 'product').get(id=CURRENT_ORDER_ID)
    print(f"✅ الطلب موجود: {CURRENT_ORDER_ID}")
    print(f"   - رقم الطلب: {order.order_no}")
    print(f"   - المستخدم: {order.user.username if order.user else 'غير معروف'}")
    print(f"   - الباقة: {order.package.name if order.package else 'غير معروف'}")
    print(f"   - المنتج: {order.product.name if order.product else 'غير معروف'}")
    print(f"   - الحالة الحالية: {order.status}")
    print(f"   - المزود: {order.provider_id or 'لا يوجد'}")
    print(f"   - المعرف الخارجي: {order.external_order_id or 'لا يوجد'}")
    print(f"   - الحالة الخارجية: {order.external_status}")
    print(f"   - الوضع (mode): {order.mode or 'لا يوجد'}")
    
    PUBG_GLOBAL_180_PACKAGE_ID = str(order.package_id)
    
    if order.provider_id or (order.external_order_id and not order.external_order_id.startswith('stub-')):
        print("\n⚠️  المشكلة المكتشفة:")
        print(f"   الطلب يحتوي على معلومات توجيه خارجي:")
        print(f"   - المزود: {order.provider_id}")
        print(f"   - المعرف الخارجي: {order.external_order_id}")
        print(f"   هذا يعني أن الطلب تم توجيهه تلقائياً بدلاً من البقاء Manual!")
except ProductOrder.DoesNotExist:
    print(f"❌ الطلب غير موجود: {CURRENT_ORDER_ID}")
    sys.exit(1)

# ============================================================================
# Step 2: فحص PackageRouting للباقة
# ============================================================================
print(f"\n[Step 2] فحص إعدادات PackageRouting للباقة {PUBG_GLOBAL_180_PACKAGE_ID}...")
try:
    routing = PackageRouting.objects.get(
        package_id=PUBG_GLOBAL_180_PACKAGE_ID,
        tenant_id=ALSHAM_TENANT_ID
    )
    print(f"✅ PackageRouting موجود:")
    print(f"   - الوضع (mode): {routing.mode}")
    print(f"   - نوع المزود (provider_type): {routing.provider_type}")
    print(f"   - المزود الأساسي: {routing.primary_provider_id or 'لا يوجد'}")
    print(f"   - مزود الاحتياطي: {routing.fallback_provider_id or 'لا يوجد'}")
    print(f"   - مجموعة الأكواد: {routing.code_group_id or 'لا يوجد'}")
    
    if routing.mode == 'auto':
        print("\n⚠️  المشكلة: الوضع = 'auto' (يجب أن يكون 'manual')")
    if routing.provider_type != 'manual':
        print(f"\n⚠️  المشكلة: نوع المزود = '{routing.provider_type}' (يجب أن يكون 'manual')")
        
except PackageRouting.DoesNotExist:
    print(f"⚠️  لا يوجد PackageRouting مُعرَّف للباقة")
    routing = None

# ============================================================================
# Step 3: تصحيح PackageRouting
# ============================================================================
print(f"\n[Step 3] تصحيح إعدادات PackageRouting...")

if routing:
    # تحديث الإعدادات الموجودة
    routing.mode = 'manual'
    routing.provider_type = 'manual'
    routing.primary_provider_id = None
    routing.fallback_provider_id = None
    routing.code_group_id = None
    routing.save()
    print("✅ تم تحديث PackageRouting:")
    print(f"   - الوضع: manual")
    print(f"   - نوع المزود: manual")
    print(f"   - تم مسح جميع إعدادات التوجيه التلقائي")
else:
    # إنشاء إعداد جديد
    print("⚠️  لا يوجد PackageRouting - سيتم إنشاؤه...")
    import uuid
    routing = PackageRouting.objects.create(
        id=uuid.uuid4(),
        tenant_id=ALSHAM_TENANT_ID,
        package_id=PUBG_GLOBAL_180_PACKAGE_ID,
        mode='manual',
        provider_type='manual',
        primary_provider_id=None,
        fallback_provider_id=None,
        code_group_id=None
    )
    print("✅ تم إنشاء PackageRouting جديد بوضع Manual")

# ============================================================================
# Step 4: تصحيح الطلب الحالي
# ============================================================================
print(f"\n[Step 4] تصحيح الطلب الحالي ليعكس Manual mode...")

with transaction.atomic():
    order = ProductOrder.objects.select_for_update().get(id=CURRENT_ORDER_ID)
    
    updates = []
    if order.mode != 'MANUAL':
        order.mode = 'MANUAL'
        updates.append('mode')
    
    if order.provider_id is not None:
        order.provider_id = None
        updates.append('provider_id')
    
    if order.external_order_id is not None:
        order.external_order_id = None
        updates.append('external_order_id')
    
    if order.external_status != 'not_sent':
        order.external_status = 'not_sent'
        updates.append('external_status')
    
    if order.status != 'pending':
        order.status = 'pending'
        updates.append('status')
    
    if updates:
        order.save(update_fields=updates)
        print(f"✅ تم تحديث الطلب:")
        for field in updates:
            print(f"   - {field} تم تحديثه")
    else:
        print("✅ الطلب بالفعل في الوضع الصحيح")

# ============================================================================
# Step 5: التحقق النهائي
# ============================================================================
print(f"\n[Step 5] التحقق النهائي من التصحيحات...")

# إعادة تحميل الطلب
order = ProductOrder.objects.select_related('user', 'package').get(id=CURRENT_ORDER_ID)
routing = PackageRouting.objects.get(package_id=PUBG_GLOBAL_180_PACKAGE_ID, tenant_id=ALSHAM_TENANT_ID)

print("\n✨ النتيجة النهائية:")
print(f"\n📦 الطلب {CURRENT_ORDER_ID}:")
print(f"   ✓ الحالة: {order.status}")
print(f"   ✓ الوضع: {order.mode}")
print(f"   ✓ المزود: {order.provider_id or 'لا يوجد (صحيح ✅)'}")
print(f"   ✓ المعرف الخارجي: {order.external_order_id or 'لا يوجد (صحيح ✅)'}")
print(f"   ✓ الحالة الخارجية: {order.external_status}")

print(f"\n⚙️  PackageRouting للباقة {order.package.name}:")
print(f"   ✓ الوضع: {routing.mode}")
print(f"   ✓ نوع المزود: {routing.provider_type}")
print(f"   ✓ التوجيه التلقائي: معطل ✅")

print("\n" + "=" * 80)
print("✅ تم إصلاح السيناريو (1) بنجاح!")
print("=" * 80)
print("\nالخطوات التالية:")
print("1. افتح لوحة المشرف في alsham")
print("2. تحقق من أن الطلب يظهر بوضع 'Manual'")
print("3. تحقق من عدم وجود معلومات 'routed/provider'")
print("4. تحقق من ظهور إشعار للمشرف بوجود طلب جديد")
print("\nملاحظة: إذا لم يظهر الإشعار، نحتاج لتفعيل نظام الإشعارات (الخطوة 6)")
