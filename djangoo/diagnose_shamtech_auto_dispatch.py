#!/usr/bin/env python
"""
تشخيص شامل لمشكلة التوجيه التلقائي من شام تيك إلى ZNET
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.products.models import ProductPackage
from apps.tenants.models import Tenant

print("="*80)
print("تشخيص شامل لمشكلة التوجيه التلقائي من شام تيك إلى ZNET")
print("="*80)

# معرفات المستأجرين
shamtech_tenant_id = "7d677574-21be-45f7-b520-22e0fe36b860"  # ShamTech

print(f"\nمعلومات شام تيك:")
print(f"   Tenant ID: {shamtech_tenant_id}")

# 1. فحص الطلبات المعلقة في شام تيك
print(f"\n1. فحص الطلبات المعلقة في شام تيك:")
pending_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending'
).order_by('-created_at')[:5]

if pending_orders.exists():
    print(f"   وجد {pending_orders.count()} طلب معلق")
    for order in pending_orders:
        print(f"   - {order.id[:8]}... | {order.package.name if order.package else 'Unknown'} | {order.user_identifier}")
else:
    print(f"   لا توجد طلبات معلقة")

# 2. فحص مزودي ZNET في شام تيك
print(f"\n2. فحص مزودي ZNET في شام تيك:")
znet_providers = Integration.objects.filter(
    tenant_id=shamtech_tenant_id,
    provider='znet'
)

if znet_providers.exists():
    print(f"   وجد {znet_providers.count()} مزود ZNET")
    for provider in znet_providers:
        print(f"   - {provider.name} (ID: {provider.id})")
        print(f"     Base URL: {provider.base_url}")
        print(f"     Active: {getattr(provider, 'active', 'Unknown')}")
else:
    print(f"   لا توجد مزودي ZNET")

# 3. فحص إعدادات PackageRouting
print(f"\n3. فحص إعدادات PackageRouting:")
routings = PackageRouting.objects.filter(
    tenant_id=shamtech_tenant_id,
    mode='auto',
    provider_type='external'
)

if routings.exists():
    print(f"   وجد {routings.count()} إعداد توجيه تلقائي خارجي")
    for routing in routings:
        print(f"   - Package ID: {routing.package_id}")
        print(f"     Mode: {routing.mode}")
        print(f"     Provider Type: {routing.provider_type}")
        print(f"     Primary Provider: {routing.primary_provider_id}")
        
        # فحص المزود الأساسي
        if routing.primary_provider_id:
            provider = Integration.objects.filter(id=routing.primary_provider_id).first()
            if provider:
                print(f"     Provider Name: {provider.name}")
                print(f"     Provider Type: {provider.provider}")
            else:
                print(f"     المزود الأساسي غير موجود!")
else:
    print(f"   لا توجد إعدادات توجيه تلقائي خارجي")

# 4. فحص PackageMapping
print(f"\n4. فحص PackageMapping:")
mappings = PackageMapping.objects.filter(
    tenant_id=shamtech_tenant_id
)

if mappings.exists():
    print(f"   وجد {mappings.count()} mapping")
    for mapping in mappings:
        print(f"   - Our Package: {mapping.our_package_id}")
        print(f"     Provider API: {mapping.provider_api_id}")
        print(f"     Provider Package: {mapping.provider_package_id}")
else:
    print(f"   لا توجد mappings")

# 5. فحص الطلبات المُوجَّهة (stub-)
print(f"\n5. فحص الطلبات المُوجَّهة (stub-):")
stub_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    external_order_id__startswith='stub-'
).order_by('-created_at')[:3]

if stub_orders.exists():
    print(f"   وجد {stub_orders.count()} طلب مُوجَّه")
    for order in stub_orders:
        print(f"   - {order.id[:8]}... | Status: {order.status}")
        print(f"     External Order ID: {order.external_order_id}")
        print(f"     Provider ID: {order.provider_id}")
        print(f"     Mode: {order.mode}")
else:
    print(f"   لا توجد طلبات مُوجَّهة")

# 6. فحص الطلبات التي تم إرسالها إلى ZNET
print(f"\n6. فحص الطلبات التي تم إرسالها إلى ZNET:")
znet_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    external_order_id__startswith='znet-'
).order_by('-created_at')[:3]

if znet_orders.exists():
    print(f"   وجد {znet_orders.count()} طلب تم إرساله إلى ZNET")
    for order in znet_orders:
        print(f"   - {order.id[:8]}... | Status: {order.status}")
        print(f"     External Order ID: {order.external_order_id}")
        print(f"     Provider ID: {order.provider_id}")
else:
    print(f"   لا توجد طلبات تم إرسالها إلى ZNET")

# 7. فحص الطلبات التي فشل توجيهها
print(f"\n7. فحص الطلبات التي فشل توجيهها:")
failed_orders = ProductOrder.objects.filter(
    tenant_id=shamtech_tenant_id,
    status='pending',
    provider_id__isnull=False,
    external_order_id__isnull=True
).order_by('-created_at')[:3]

if failed_orders.exists():
    print(f"   وجد {failed_orders.count()} طلب فشل توجيهه")
    for order in failed_orders:
        print(f"   - {order.id[:8]}... | Provider: {order.provider_id}")
        print(f"     Status: {order.status}")
        print(f"     External Status: {order.external_status}")
else:
    print(f"   لا توجد طلبات فشل توجيهها")

print("\n" + "="*80)
print("انتهى التشخيص")
print("="*80)
