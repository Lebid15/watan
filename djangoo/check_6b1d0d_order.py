"""
فحص الطلب 6B1D0D في shamtech والتحقق من سبب فشل dispatch
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting, PackageMapping

print("="*80)
print("فحص الطلب 6B1D0D في shamtech")
print("="*80)

# البحث عن الطلب - نبحث بـ external_order_id في alsham أولاً
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
alsham_order = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id,
    id__startswith='bd3319'
).first()

if not alsham_order:
    # البحث بطريقة أخرى
    alsham_order = ProductOrder.objects.filter(
        tenant_id=alsham_tenant_id,
        user_identifier='6666'
    ).order_by('-created_at').first()

if alsham_order:
    print(f"\n📦 الطلب الأصلي في alsham:")
    print(f"   Order ID: {alsham_order.id}")
    print(f"   Status: {alsham_order.status}")
    print(f"   Provider ID: {alsham_order.provider_id}")
    print(f"   External Order ID: {alsham_order.external_order_id}")
    
    if alsham_order.external_order_id:
        # البحث عن الطلب في shamtech
        shamtech_order = ProductOrder.objects.filter(
            id=alsham_order.external_order_id
        ).first()
        
        if shamtech_order:
            print(f"\n📦 الطلب في shamtech:")
            print(f"   Order ID: {shamtech_order.id}")
            print(f"   Tenant ID: {shamtech_order.tenant_id}")
            print(f"   Package ID: {shamtech_order.package_id}")
            print(f"   Status: {shamtech_order.status}")
            print(f"   Provider ID: {shamtech_order.provider_id}")
            print(f"   External Order ID: {shamtech_order.external_order_id}")
            print(f"   External Status: {shamtech_order.external_status}")
            print(f"   User Identifier: {shamtech_order.user_identifier}")
            
            # التحقق من PackageRouting
            print(f"\n🔀 PackageRouting في shamtech:")
            routing = PackageRouting.objects.filter(
                package_id=shamtech_order.package_id,
                tenant_id=shamtech_order.tenant_id
            ).first()
            
            if routing:
                print(f"   Mode: {routing.mode}")
                print(f"   Provider Type: {routing.provider_type}")
                print(f"   Primary Provider ID: {routing.primary_provider_id}")
            else:
                print(f"   ❌ لا يوجد PackageRouting!")
            
            # التحقق من alayaZnet integration
            print(f"\n📡 alayaZnet Integration في shamtech:")
            znet = Integration.objects.filter(
                tenant_id=shamtech_order.tenant_id,
                name='alayaZnet'
            ).first()
            
            if znet:
                print(f"   ID: {znet.id}")
                print(f"   Name: {znet.name}")
                print(f"   Provider: {znet.provider}")
                print(f"   Base URL: {znet.base_url}")
                
                # التحقق من PackageMapping
                print(f"\n🗺️  PackageMapping:")
                mapping = PackageMapping.objects.filter(
                    our_package_id=shamtech_order.package_id,
                    provider_api_id=znet.id,
                    tenant_id=shamtech_order.tenant_id
                ).first()
                
                if mapping:
                    print(f"   ✅ PackageMapping موجود!")
                    print(f"   Provider Package ID: {mapping.provider_package_id}")
                else:
                    print(f"   ❌ لا يوجد PackageMapping!")
                    print(f"   ⚠️ هذا قد يكون السبب في فشل dispatch!")
            else:
                print(f"   ❌ alayaZnet integration غير موجود!")
else:
    print("❌ لم أجد الطلب في alsham!")

print("\n" + "="*80)
