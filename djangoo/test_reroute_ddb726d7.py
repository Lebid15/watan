"""
إعادة توجيه الطلب DDB726D7 من alsham إلى diana

هذا يحاكي ما يفعله الأدمن عندما يضغط "Dispatch to Provider" ويختار diana
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

print("="*80)
print("إعادة توجيه الطلب DDB726D7 إلى diana")
print("="*80)

# تحميل الطلب
order = ProductOrder.objects.filter(
    id='ddb726d7-5cb0-4e73-beb9-67df5c9a3dfe'
).first()

if not order:
    print("❌ الطلب غير موجود!")
    exit(1)

print(f"\n📦 الطلب:")
print(f"   ID: {order.id}")
print(f"   Status: {order.status}")
print(f"   Provider ID: {order.provider_id}")

# التأكد من diana integration
diana = Integration.objects.filter(name='diana', tenant_id=order.tenant_id).first()
if not diana:
    print("\n❌ diana integration غير موجود!")
    exit(1)

print(f"\n📡 Diana Integration:")
print(f"   ID: {diana.id}")
print(f"   Name: {diana.name}")
print(f"   Base URL: {diana.base_url}")

# تحديث PackageRouting مؤقتاً للسماح بـ auto dispatch
print(f"\n🔧 تحديث PackageRouting مؤقتاً...")
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=order.tenant_id
).first()

if not routing:
    print("❌ PackageRouting غير موجود!")
    exit(1)

original_mode = routing.mode
original_provider_type = routing.provider_type
original_primary_provider_id = routing.primary_provider_id

routing.mode = 'auto'
routing.provider_type = 'external'
routing.primary_provider_id = diana.id
routing.save(update_fields=['mode', 'provider_type', 'primary_provider_id'])

print(f"   ✅ تم تحديث PackageRouting")
print(f"      Mode: {original_mode} → auto")
print(f"      Provider Type: {original_provider_type} → external")
print(f"      Primary Provider ID: {original_primary_provider_id} → {diana.id}")

# إعادة التوجيه
print(f"\n🚀 إرسال الطلب إلى diana...")
result = try_auto_dispatch(str(order.id), str(order.tenant_id))

# إعادة الإعدادات الأصلية
print(f"\n🔄 إعادة PackageRouting للإعدادات الأصلية...")
routing.mode = original_mode
routing.provider_type = original_provider_type
routing.primary_provider_id = original_primary_provider_id
routing.save(update_fields=['mode', 'provider_type', 'primary_provider_id'])

# فحص النتيجة
order.refresh_from_db()

print(f"\n" + "="*80)
print(f"✅ نتائج إعادة التوجيه:")
print(f"="*80)
print(f"   Provider ID: {order.provider_id}")
print(f"   External Order ID: {order.external_order_id}")
print(f"   External Status: {order.external_status}")

if order.external_order_id:
    print(f"\n🔍 فحص الطلب الجديد في diana...")
    
    diana_order = ProductOrder.objects.filter(
        id=order.external_order_id
    ).first()
    
    if diana_order:
        print(f"   ✅ تم العثور على الطلب في diana!")
        print(f"   Order ID: {diana_order.id}")
        print(f"   Tenant ID: {diana_order.tenant_id}")
        print(f"   Provider ID: {diana_order.provider_id}")
        print(f"   Status: {diana_order.status}")
        print(f"   External Status: {diana_order.external_status}")
        
        if diana_order.provider_id:
            print(f"\n   ❌ خطأ: provider_id يجب أن يكون NULL (Manual)!")
            print(f"   القيمة الحالية: {diana_order.provider_id}")
        else:
            print(f"\n   ✅ صحيح: provider_id = NULL (Manual)")
    else:
        print(f"   ❌ الطلب غير موجود في diana!")

print("\n" + "="*80)
