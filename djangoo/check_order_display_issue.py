import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration

print("=" * 80)
print("فحص عرض الطلب 064B1B")
print("=" * 80)

# الطلب الأصلي في alsham
alsham_order = ProductOrder.objects.filter(
    short_order_id='064B1B'
).select_related('provider', 'tenant').first()

if alsham_order:
    print(f"\n📦 الطلب في alsham:")
    print(f"   Order ID: {alsham_order.id}")
    print(f"   Short ID: {alsham_order.short_order_id}")
    print(f"   Status: {alsham_order.status}")
    print(f"   External Status: {alsham_order.external_status}")
    print(f"   Provider ID: {alsham_order.provider_id}")
    
    if alsham_order.provider:
        print(f"   Provider Type: {alsham_order.provider.provider_type}")
        print(f"   Provider Name: {alsham_order.provider.name}")
        print(f"   Provider Display: '{alsham_order.provider.name}' ← يجب أن يظهر هذا!")
    
    print(f"   External Order ID: {alsham_order.external_order_id}")

# الطلب في shamtech
print(f"\n" + "=" * 80)
shamtech_order = ProductOrder.objects.filter(
    id='8b020a47-cd37-498f-9bf4-621fd3c26a65'
).select_related('provider', 'tenant').first()

if shamtech_order:
    print(f"📦 الطلب في shamtech:")
    print(f"   Order ID: {shamtech_order.id}")
    print(f"   Short ID: {shamtech_order.short_order_id}")
    print(f"   Status: {shamtech_order.status}")
    print(f"   External Status: {shamtech_order.external_status}")
    print(f"   Provider ID: {shamtech_order.provider_id}")
    
    if shamtech_order.provider:
        print(f"   Provider Name: {shamtech_order.provider.name}")
        print(f"   Provider Display: '{shamtech_order.provider.name}' ← يجب أن يظهر هذا!")
    else:
        print(f"   Provider: NULL → يجب أن يظهر 'Manual'")
    
    print(f"   Referrer Order ID: {shamtech_order.referrer_order_id}")
    if shamtech_order.referrer_order_id:
        print(f"      ↑ هذا هو UUID الطلب الأصلي من alsham")

print("\n" + "=" * 80)
print("🔍 التحقق من Integration diana:")
diana = Integration.objects.filter(name='diana').first()
if diana:
    print(f"   ID: {diana.id}")
    print(f"   Name: {diana.name}")
    print(f"   Display Name: {diana.display_name or diana.name}")
print("=" * 80)
