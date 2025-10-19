import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.tenants.models import Tenant

print("="*80)
print("التحقق من diana integration")
print("="*80)

diana = Integration.objects.filter(id='71544f6c-705e-4e7f-bc3c-c24dc90428b7').first()

if diana:
    print(f"\n📡 Diana Integration:")
    print(f"   ID: {diana.id}")
    print(f"   Name: {diana.name}")
    print(f"   Provider: {diana.provider}")
    print(f"   Tenant ID: {diana.tenant_id}")
    
    tenant = Tenant.objects.filter(id=diana.tenant_id).first()
    if tenant:
        print(f"   Tenant Name: {tenant.name}")
    
    print(f"\n   Base URL: {diana.base_url}")
    
# التحقق من الطلب في shamtech
from apps.orders.models import ProductOrder

order_shamtech = ProductOrder.objects.filter(
    id='8b020a47-cd37-498f-9bf4-621fd3c26a65'
).first()

if order_shamtech:
    print(f"\n📦 الطلب في shamtech:")
    print(f"   Tenant ID: {order_shamtech.tenant_id}")
    
    tenant = Tenant.objects.filter(id=order_shamtech.tenant_id).first()
    if tenant:
        print(f"   Tenant Name: {tenant.name}")
        print(f"   ⚠️ المشكلة: base_url في diana يشير إلى tenant: {diana.base_url if diana else 'N/A'}")

print("\n" + "="*80)
