"""
إنشاء PackageRouting لباقة pubg global 325 في alsham
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting
import uuid

print("="*80)
print("إنشاء PackageRouting لباقة pubg global 325")
print("="*80)

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
package_id = 'a8a02e3a-2f8d-4416-8390-d1a102302c00'  # pubg global 325

# التحقق من عدم وجود routing
existing = PackageRouting.objects.filter(
    package_id=package_id,
    tenant_id=alsham_tenant_id
).first()

if existing:
    print(f"\n⚠️  PackageRouting موجود بالفعل!")
    print(f"   Mode: {existing.mode}")
    print(f"   Provider Type: {existing.provider_type}")
    exit(0)

# إنشاء PackageRouting
routing = PackageRouting.objects.create(
    id=uuid.uuid4(),
    package_id=package_id,
    tenant_id=alsham_tenant_id,
    mode='manual',
    provider_type='manual',
    primary_provider_id=None
)

print(f"\n✅ تم إنشاء PackageRouting:")
print(f"   ID: {routing.id}")
print(f"   Package ID: {routing.package_id}")
print(f"   Mode: {routing.mode}")
print(f"   Provider Type: {routing.provider_type}")
print(f"   Primary Provider ID: {routing.primary_provider_id}")

print("\n" + "="*80)
print("✅ الآن يمكنك إعادة محاولة dispatch!")
print("="*80)
