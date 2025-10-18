"""
إضافة routing لباقة PUBG Global 660
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting

TENANT_SHAMTECH = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"
PACKAGE_PUBG_GLOBAL_660 = "acc3681d-80b3-4c30-8c65-6c2a8f8723a4"
CODE_GROUP_PUBG_660 = "1598eb19-ade7-4185-9dfe-6e370bed4d43"

print("=" * 80)
print("📝 Adding PackageRouting for PUBG Global 660")
print("=" * 80)

# فحص إذا كان موجود
existing = PackageRouting.objects.filter(
    package_id=PACKAGE_PUBG_GLOBAL_660,
    tenant_id=TENANT_SHAMTECH
).first()

if existing:
    print(f"\n⚠️ Routing already exists!")
    print(f"   Mode: {existing.mode}")
    print(f"   Provider Type: {existing.provider_type}")
    print(f"   Code Group: {existing.code_group_id}")
else:
    print(f"\n✅ Creating new routing...")
    import uuid
    routing = PackageRouting.objects.create(
        id=uuid.uuid4(),
        package_id=PACKAGE_PUBG_GLOBAL_660,
        tenant_id=TENANT_SHAMTECH,
        mode='auto',
        provider_type='codes',
        code_group_id=CODE_GROUP_PUBG_660,
        primary_provider_id=None
    )
    print(f"   ✅ Created!")
    print(f"   Package: PUBG Global 660")
    print(f"   Mode: auto")
    print(f"   Provider Type: codes")
    print(f"   Code Group: {CODE_GROUP_PUBG_660}")

print("\n" + "=" * 80)
