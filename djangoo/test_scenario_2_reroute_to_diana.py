"""
اختبار السيناريو (2): إعادة التوجيه اليدوي من alsham إلى shamtech (diana)

الطلب: 064B1B (3b550ba4-2266-47f0-a815-090929064b1b)
المستخدم: halil
الهدف: إعادة توجيه الطلب يدوياً إلى shamtech (diana)
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration
from apps.orders.services import try_auto_dispatch

# معرفات البيانات
ALSHAM_TENANT_ID = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
ORDER_ID = "3b550ba4-2266-47f0-a815-090929064b1b"

print("=" * 100)
print("🔄 اختبار السيناريو (2): إعادة التوجيه اليدوي من alsham إلى shamtech")
print("=" * 100)

# ============================================================================
# Step 1: فحص الطلب الحالي
# ============================================================================
print("\n[Step 1] فحص الطلب الحالي...")

try:
    order = ProductOrder.objects.select_related('user', 'package', 'product').get(id=ORDER_ID)
    print(f"✅ الطلب موجود: {str(order.id)[-6:].upper()}")
    print(f"   - Username: {order.user.username if order.user else 'N/A'}")
    print(f"   - Package: {order.package.name if order.package else 'N/A'}")
    print(f"   - Status: {order.status}")
    print(f"   - Mode: {order.mode}")
    print(f"   - Provider ID: {order.provider_id or 'NULL'}")
    print(f"   - External Order ID: {order.external_order_id or 'NULL'}")
    
    # فحص الحالة
    current_status = (order.status or '').strip().lower()
    if current_status not in ('pending', ''):
        print(f"\n❌ الطلب لا يمكن إعادة توجيهه")
        print(f"   السبب: status = '{order.status}' (يجب أن يكون pending)")
        sys.exit(1)
    
    print(f"\n✅ الطلب جاهز لإعادة التوجيه")
    
except ProductOrder.DoesNotExist:
    print(f"❌ الطلب غير موجود: {ORDER_ID}")
    sys.exit(1)

# ============================================================================
# Step 2: البحث عن integration diana (shamtech)
# ============================================================================
print("\n[Step 2] البحث عن integration diana (shamtech)...")

try:
    # البحث عن integration باسم diana أو shamtech
    diana_integration = Integration.objects.filter(
        tenant_id=ALSHAM_TENANT_ID,
        name__icontains='diana'
    ).first()
    
    if not diana_integration:
        diana_integration = Integration.objects.filter(
            tenant_id=ALSHAM_TENANT_ID,
            name__icontains='shamtech'
        ).first()
    
    if diana_integration:
        print(f"✅ تم العثور على Integration:")
        print(f"   - ID: {diana_integration.id}")
        print(f"   - Name: {diana_integration.name}")
        print(f"   - Provider: {diana_integration.provider}")
        print(f"   - Enabled: {diana_integration.enabled}")
        
        DIANA_PROVIDER_ID = str(diana_integration.id)
    else:
        print(f"❌ لم يتم العثور على integration diana/shamtech")
        print(f"\n🔍 البحث عن جميع integrations في alsham...")
        
        all_integrations = Integration.objects.filter(
            tenant_id=ALSHAM_TENANT_ID
        ).values('id', 'name', 'provider', 'enabled')
        
        if all_integrations:
            print(f"   وجدت {len(all_integrations)} integration:")
            for integ in all_integrations:
                print(f"   - {integ['name']} ({integ['provider']}) - ID: {integ['id']}")
        
        sys.exit(1)
        
except Exception as e:
    print(f"❌ خطأ في البحث عن integration: {e}")
    sys.exit(1)

# ============================================================================
# Step 3: تحديث PackageRouting مؤقتاً للتوجيه
# ============================================================================
print("\n[Step 3] تحديث PackageRouting مؤقتاً...")

with transaction.atomic():
    try:
        routing = PackageRouting.objects.select_for_update().get(
            package_id=order.package_id,
            tenant_id=ALSHAM_TENANT_ID
        )
        
        print(f"✅ PackageRouting موجود:")
        print(f"   - Mode (before): {routing.mode}")
        print(f"   - Provider Type (before): {routing.provider_type}")
        print(f"   - Primary Provider (before): {routing.primary_provider_id or 'NULL'}")
        
        # حفظ الإعدادات الأصلية
        original_mode = routing.mode
        original_provider_type = routing.provider_type
        original_primary_provider = routing.primary_provider_id
        
        # تحديث الإعدادات للتوجيه
        routing.mode = 'auto'
        routing.provider_type = 'external'
        routing.primary_provider_id = DIANA_PROVIDER_ID
        routing.save()
        
        print(f"\n✅ تم تحديث PackageRouting:")
        print(f"   - Mode (after): {routing.mode}")
        print(f"   - Provider Type (after): {routing.provider_type}")
        print(f"   - Primary Provider (after): {routing.primary_provider_id}")
        
        # ============================================================================
        # Step 4: محاولة إعادة التوجيه
        # ============================================================================
        print(f"\n[Step 4] محاولة إعادة التوجيه إلى diana...")
        
        try:
            print(f"   🚀 استدعاء try_auto_dispatch...")
            try_auto_dispatch(str(order.id), str(ALSHAM_TENANT_ID))
            print(f"   ✅ تم تنفيذ try_auto_dispatch بنجاح")
        except Exception as dispatch_error:
            print(f"   ⚠️  حدث خطأ في try_auto_dispatch: {dispatch_error}")
        
        # ============================================================================
        # Step 5: فحص النتيجة
        # ============================================================================
        print(f"\n[Step 5] فحص النتيجة...")
        
        # إعادة تحميل الطلب
        order_after = ProductOrder.objects.get(id=ORDER_ID)
        
        print(f"\n📊 حالة الطلب بعد إعادة التوجيه:")
        print(f"   - Status: {order_after.status}")
        print(f"   - Mode: {order_after.mode}")
        print(f"   - Provider ID: {order_after.provider_id or 'NULL'}")
        print(f"   - External Order ID: {order_after.external_order_id or 'NULL'}")
        print(f"   - External Status: {order_after.external_status}")
        print(f"   - Provider Message: {order_after.provider_message or 'NULL'}")
        print(f"   - Manual Note: {order_after.manual_note or 'NULL'}")
        
        # التحقق من النجاح
        success = (
            order_after.provider_id == DIANA_PROVIDER_ID and
            order_after.external_order_id is not None
        )
        
        if success:
            print(f"\n✅ نجح! تم إعادة توجيه الطلب إلى diana")
            print(f"   - Provider ID: {order_after.provider_id}")
            print(f"   - External Order ID: {order_after.external_order_id}")
        else:
            print(f"\n⚠️  لم يتم التوجيه بنجاح")
            if not order_after.provider_id:
                print(f"   - Provider ID لا يزال NULL")
            if not order_after.external_order_id:
                print(f"   - External Order ID لا يزال NULL")
        
        # ============================================================================
        # Step 6: إعادة الإعدادات الأصلية
        # ============================================================================
        print(f"\n[Step 6] إعادة إعدادات PackageRouting الأصلية...")
        
        routing.mode = original_mode
        routing.provider_type = original_provider_type
        routing.primary_provider_id = original_primary_provider
        routing.save()
        
        print(f"✅ تم إعادة الإعدادات:")
        print(f"   - Mode: {routing.mode}")
        print(f"   - Provider Type: {routing.provider_type}")
        print(f"   - Primary Provider: {routing.primary_provider_id or 'NULL'}")
        
    except PackageRouting.DoesNotExist:
        print(f"❌ لا يوجد PackageRouting للباقة")
        sys.exit(1)

print("\n" + "=" * 100)
print("✅ اكتمل اختبار السيناريو (2)")
print("=" * 100)

print("\n🎯 الخطوات التالية:")
print("1. تحقق من لوحة المشرف في alsham")
print(f"2. ابحث عن الطلب 064B1B")
print("3. تأكد من:")
print("   ✓ تم إرساله إلى diana (shamtech)")
print("   ✓ يظهر External Order ID")
print("   ✓ الحالة تغيرت حسب استجابة المزود")
