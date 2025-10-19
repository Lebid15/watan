import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration

print("="*80)
print("فحص عرض الطلبات")
print("="*80)

# الطلب في alsham
print("\n1️⃣ الطلب في alsham (064B1B):")
alsham_order = ProductOrder.objects.filter(
    id='3b550ba4-2266-47f0-a815-090929064b1b'
).first()

if alsham_order:
    print(f"   Order ID: {alsham_order.id}")
    print(f"   Status: {alsham_order.status}")
    print(f"   Provider ID: {alsham_order.provider_id}")
    
    # الحصول على معلومات المزود
    if alsham_order.provider_id:
        provider = Integration.objects.filter(id=alsham_order.provider_id).first()
        if provider:
            print(f"   Provider Name: {provider.name}")
            print(f"   ✅ يجب أن يظهر: 'diana'")
    else:
        print(f"   Provider: NULL")
        
    print(f"   External Order ID: {alsham_order.external_order_id}")

# الطلب في shamtech
print("\n2️⃣ الطلب في shamtech:")
shamtech_order = ProductOrder.objects.filter(
    id='8b020a47-cd37-498f-9bf4-621fd3c26a65'
).first()

if shamtech_order:
    print(f"   Order ID: {shamtech_order.id}")
    print(f"   Status: {shamtech_order.status}")
    print(f"   Provider ID: {shamtech_order.provider_id}")
    
    if shamtech_order.provider_id:
        provider = Integration.objects.filter(id=shamtech_order.provider_id).first()
        if provider:
            print(f"   Provider Name: {provider.name}")
            print(f"   ✅ يجب أن يظهر اسم المزود")
    else:
        print(f"   Provider: NULL")
        print(f"   ✅ يجب أن يظهر: 'Manual'")

print("\n" + "="*80)
