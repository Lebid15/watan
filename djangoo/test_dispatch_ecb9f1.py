"""
محاولة dispatch الطلب ECB9F1 إلى diana والتقاط الخطأ الحقيقي
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, Integration
from apps.orders.services import try_auto_dispatch
import traceback

print("="*80)
print("محاولة dispatch الطلب ECB9F1 إلى diana")
print("="*80)

# تحميل الطلب
order = ProductOrder.objects.filter(
    id='57e4b366-d2ec-475a-9f4b-236af7ecb9f1'
).first()

if not order:
    print("❌ الطلب غير موجود!")
    exit(1)

print(f"\n📦 الطلب:")
print(f"   ID: {order.id}")
print(f"   Status: {order.status}")
print(f"   Package ID: {order.package_id}")

# التحقق من diana
diana = Integration.objects.filter(
    name='diana',
    tenant_id=order.tenant_id
).first()

if not diana:
    print("\n❌ diana integration غير موجود!")
    exit(1)

print(f"\n📡 Diana Integration:")
print(f"   ID: {diana.id}")
print(f"   Base URL: {diana.base_url}")

# التحقق من PackageRouting
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=order.tenant_id
).first()

if not routing:
    print("\n❌ PackageRouting غير موجود!")
    exit(1)

print(f"\n🔀 PackageRouting (قبل التعديل):")
print(f"   Mode: {routing.mode}")
print(f"   Provider Type: {routing.provider_type}")
print(f"   Primary Provider ID: {routing.primary_provider_id}")

# حفظ الإعدادات الأصلية
original_mode = routing.mode
original_provider_type = routing.provider_type
original_primary_provider_id = routing.primary_provider_id

# تحديث مؤقتاً للسماح بـ dispatch
print(f"\n🔧 تحديث PackageRouting مؤقتاً...")
routing.mode = 'auto'
routing.provider_type = 'external'
routing.primary_provider_id = diana.id
routing.save(update_fields=['mode', 'provider_type', 'primary_provider_id'])
print(f"   ✅ تم التحديث")

# محاولة dispatch
print(f"\n🚀 محاولة dispatch...")
try:
    result = try_auto_dispatch(str(order.id), str(order.tenant_id))
    print(f"\n✅ Dispatch نجح!")
    print(f"   Result: {result}")
    
except Exception as e:
    print(f"\n❌ Dispatch فشل!")
    print(f"\n🔴 الخطأ الحقيقي:")
    print(f"   Type: {type(e).__name__}")
    print(f"   Message: {str(e)}")
    print(f"\n📋 Stack Trace:")
    traceback.print_exc()

finally:
    # إعادة الإعدادات الأصلية
    print(f"\n🔄 إعادة PackageRouting للإعدادات الأصلية...")
    routing.mode = original_mode
    routing.provider_type = original_provider_type
    routing.primary_provider_id = original_primary_provider_id
    routing.save(update_fields=['mode', 'provider_type', 'primary_provider_id'])
    print(f"   ✅ تم الإعادة")

# فحص النتيجة
order.refresh_from_db()
print(f"\n📊 حالة الطلب بعد المحاولة:")
print(f"   Provider ID: {order.provider_id}")
print(f"   External Order ID: {order.external_order_id}")
print(f"   External Status: {order.external_status}")
print(f"   Provider Message: {order.provider_message}")

print("\n" + "="*80)
