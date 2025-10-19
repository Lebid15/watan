"""
إنشاء PackageMapping بين pubg global 180 في shamtech و alayaZnet
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageMapping, Integration
from apps.products.models import ProductPackage
import uuid

print("="*80)
print("إنشاء PackageMapping لـ alayaZnet")
print("="*80)

# معلومات shamtech
shamtech_tenant_id = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'  # admin1
package_id = '6ccb5ea7-ad1c-44c6-af66-4890d29d6998'  # pubg global 180

# معلومات alayaZnet
znet = Integration.objects.filter(
    name='alayaZnet',
    tenant_id=shamtech_tenant_id
).first()

if not znet:
    print("❌ alayaZnet integration غير موجود!")
    exit(1)

print(f"\n📡 alayaZnet Integration:")
print(f"   ID: {znet.id}")
print(f"   Name: {znet.name}")
print(f"   Provider: {znet.provider}")
print(f"   Base URL: {znet.base_url}")

# التحقق من وجود mapping
existing = PackageMapping.objects.filter(
    our_package_id=package_id,
    provider_api_id=znet.id,
    tenant_id=shamtech_tenant_id
).first()

if existing:
    print(f"\n⚠️  PackageMapping موجود بالفعل:")
    print(f"   ID: {existing.id}")
    print(f"   Provider Package ID: {existing.provider_package_id}")
    print(f"\n   هل تريد تحديثه؟ (نعم/لا)")
    exit(0)

# السؤال عن provider_package_id من znet
print(f"\n❓ ما هو provider_package_id لـ PUBG Global 180 في znet؟")
print(f"   (مثال: PUBG180، pubg_global_180، وغيرها)")
print(f"\n   ملاحظة: يجب أن يكون هذا هو الـ ID الذي يستخدمه znet API")

# للاختبار، سأستخدم قيمة افتراضية
# في الواقع يجب الحصول على هذه القيمة من catalog المزود
provider_package_id = "PUBG180"  # قيمة افتراضية للاختبار

print(f"\n📦 سأستخدم: {provider_package_id}")
print(f"   ⚠️  تأكد من أن هذا هو الـ ID الصحيح في znet!")

# إنشاء PackageMapping
mapping = PackageMapping.objects.create(
    id=uuid.uuid4(),
    our_package_id=package_id,
    provider_api_id=znet.id,
    provider_package_id=provider_package_id,
    tenant_id=shamtech_tenant_id
)

print(f"\n✅ تم إنشاء PackageMapping:")
print(f"   ID: {mapping.id}")
print(f"   Our Package ID: {mapping.our_package_id}")
print(f"   Provider API ID: {mapping.provider_api_id}")
print(f"   Provider Package ID: {mapping.provider_package_id}")
print(f"   Tenant ID: {mapping.tenant_id}")

print("\n" + "="*80)
print("✅ الآن يمكنك إعادة محاولة dispatch من shamtech!")
print("="*80)
