import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.tenants.models import Tenant, TenantDomain

print("="*80)
print("إصلاح diana integration - تحديث base_url")
print("="*80)

# البحث عن Diana tenant الصحيح
diana_tenant = Tenant.objects.filter(
    id='7d677574-21be-45f7-b520-22e0fe36b860'
).first()

if not diana_tenant:
    print("❌ Diana tenant غير موجود!")
    exit(1)

print(f"\n✅ Diana Tenant:")
print(f"   ID: {diana_tenant.id}")
print(f"   Name: {diana_tenant.name}")

# البحث عن domain الخاص بـ Diana
domain = TenantDomain.objects.filter(
    tenant_id=diana_tenant.id,
    is_primary=True
).first()

if domain:
    print(f"   Domain: {domain.domain}")
    diana_host = domain.domain
else:
    print(f"   ⚠️ لا يوجد domain، سأستخدم diana.localhost")
    diana_host = "diana.localhost"

# تحديث diana integration
diana = Integration.objects.filter(
    id='71544f6c-705e-4e7f-bc3c-c24dc90428b7'
).first()

if not diana:
    print("\n❌ Diana integration غير موجود!")
    exit(1)

print(f"\n📡 Diana Integration (قبل التعديل):")
print(f"   Base URL: {diana.base_url}")

# تحديث base_url
new_base_url = f"http://{diana_host}/"
diana.base_url = new_base_url
diana.save(update_fields=['base_url'])

print(f"\n✅ تم التحديث:")
print(f"   Base URL الجديد: {new_base_url}")

print("\n" + "="*80)
print("✅ تم إصلاح diana integration بنجاح!")
print("="*80)
