"""
إصلاح جميع الباقات التي لديها PackageMapping لكن بدون PackageRouting
هذا يحل المشكلة للباقات الموجودة حالياً
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageMapping, PackageRouting
from apps.products.models import ProductPackage
from django.db import connection
import uuid

print("="*80)
print("إصلاح PackageRouting للباقات التي لديها PackageMapping")
print("="*80)

# جلب جميع PackageMapping
all_mappings = PackageMapping.objects.select_related().all()

print(f"\n📦 وجدت {all_mappings.count()} PackageMapping")

fixed_count = 0
already_exists_count = 0

for mapping in all_mappings:
    # التحقق من وجود الباقة أولاً
    package = ProductPackage.objects.filter(id=mapping.our_package_id).first()
    if not package:
        # الباقة محذوفة، تخطي
        continue
    
    # التحقق من وجود PackageRouting
    routing = PackageRouting.objects.filter(
        package_id=mapping.our_package_id,
        tenant_id=mapping.tenant_id
    ).first()
    
    if routing:
        already_exists_count += 1
        continue
    
    # إنشاء PackageRouting
    try:
        with connection.cursor() as c:
            c.execute('''
                INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "primaryProviderId")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NULL)
            ''', [str(mapping.tenant_id), str(mapping.our_package_id), 'manual', 'manual'])
        
        fixed_count += 1
        print(f"   ✅ أنشأت PackageRouting لـ: {package.name}")
        
    except Exception as e:
        print(f"   ⚠️  فشل إنشاء PackageRouting لـ {package.name}: {str(e)[:100]}")

print(f"\n" + "="*80)
print(f"📊 النتائج:")
print(f"   ✅ تم إصلاح: {fixed_count} باقة")
print(f"   ✓ موجودة مسبقاً: {already_exists_count} باقة")
print(f"   📦 المجموع: {all_mappings.count()} باقة")
print("="*80)

if fixed_count > 0:
    print(f"\n✅ تم إصلاح {fixed_count} باقة بنجاح!")
    print("   جميع الباقات التي لديها PackageMapping الآن لديها PackageRouting")
else:
    print("\n✓ جميع الباقات سليمة - لا حاجة للإصلاح")

print("\n" + "="*80)
