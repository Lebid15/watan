"""
إنشاء PackageRouting لباقة pubg global 1800 في alsham
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting
from apps.products.models import ProductPackage
from django.db import connection

print("="*80)
print("إنشاء PackageRouting لباقة pubg global 1800")
print("="*80)

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

# البحث عن الباقة
package = ProductPackage.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='pubg global 1800'
).first()

if not package:
    print("\n❌ لم أجد الباقة pubg global 1800!")
    exit(1)

print(f"\n📦 الباقة:")
print(f"   ID: {package.id}")
print(f"   Name: {package.name}")

# التحقق من وجود PackageRouting
routing = PackageRouting.objects.filter(
    package_id=package.id,
    tenant_id=alsham_tenant_id
).first()

if routing:
    print(f"\n✅ PackageRouting موجود بالفعل!")
    print(f"   Mode: {routing.mode}")
    print(f"   Provider Type: {routing.provider_type}")
else:
    # إنشاء PackageRouting
    with connection.cursor() as c:
        c.execute('''
            INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "primaryProviderId")
            VALUES (gen_random_uuid(), %s, %s, %s, %s, NULL)
        ''', [alsham_tenant_id, str(package.id), 'manual', 'manual'])
    
    print(f"\n✅ تم إنشاء PackageRouting بنجاح!")
    print(f"   Mode: manual")
    print(f"   Provider Type: manual")

print("\n" + "="*80)
print("✅ الآن يمكنك إعادة محاولة dispatch الطلب B333F6!")
print("="*80)
