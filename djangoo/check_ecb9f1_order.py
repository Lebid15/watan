"""
فحص الطلب ECB9F1 والتحقق من سبب فشل dispatch إلى shamtech (diana)
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageMapping
from apps.products.models import ProductPackage

print("="*80)
print("فحص الطلب ECB9F1")
print("="*80)

# البحث عن الطلب في alsham
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

# البحث بـ user_identifier
order = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id,
    user_identifier='545454'
).order_by('-created_at').first()

if not order:
    # البحث بـ ID
    order = ProductOrder.objects.filter(
        tenant_id=alsham_tenant_id,
        id__istartswith='ecb9f1'
    ).first()

if not order:
    print("❌ لم أجد الطلب!")
    exit(1)

print(f"\n📦 الطلب في alsham:")
print(f"   Order ID: {order.id}")
print(f"   Package ID: {order.package_id}")
print(f"   Status: {order.status}")
print(f"   Provider ID: {order.provider_id}")
print(f"   External Order ID: {order.external_order_id}")
print(f"   External Status: {order.external_status}")
print(f"   User Identifier: {order.user_identifier}")

# الحصول على معلومات الباقة
package = ProductPackage.objects.filter(id=order.package_id).first()
if package:
    print(f"\n📦 الباقة:")
    print(f"   Name: {package.name}")
    print(f"   ID: {package.id}")

# التحقق من diana integration
print(f"\n📡 diana Integration:")
diana = Integration.objects.filter(
    name='diana',
    tenant_id=alsham_tenant_id
).first()

if diana:
    print(f"   ID: {diana.id}")
    print(f"   Name: {diana.name}")
    print(f"   Provider: {diana.provider}")
    print(f"   Base URL: {diana.base_url}")
    
    # التحقق من PackageMapping
    print(f"\n🗺️  PackageMapping:")
    mapping = PackageMapping.objects.filter(
        our_package_id=order.package_id,
        provider_api_id=diana.id,
        tenant_id=alsham_tenant_id
    ).first()
    
    if mapping:
        print(f"   ✅ PackageMapping موجود!")
        print(f"   Provider Package ID: {mapping.provider_package_id}")
    else:
        print(f"   ❌ لا يوجد PackageMapping!")
        print(f"   ⚠️ هذا هو السبب في فشل dispatch!")
        print(f"\n   يجب إنشاء PackageMapping بين:")
        print(f"   - Our Package: {order.package_id} ({package.name if package else 'unknown'})")
        print(f"   - Provider: {diana.id} (diana)")
        print(f"   - Tenant: {alsham_tenant_id}")
else:
    print(f"   ❌ diana integration غير موجود!")

print("\n" + "="*80)
