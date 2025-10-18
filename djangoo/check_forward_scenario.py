"""
فحص السيناريو الكامل: Forward من الشام إلى شام تيك
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# الطلبات التي تم إنشاؤها سابقاً
ORDER_ALSHAM = "99731ad7-741b-49c0-8e6d-f22c7827f71b"  # طلب الشام (المُوجِّه)
ORDER_SHAMTECH = "7840a9cc-5a8f-4ebd-be4a-ef0d8e52fa70"  # طلب شام تيك (المُستقبِل)

print("=" * 80)
print("🔍 Checking Forward Scenario: الشام → شام تيك")
print("=" * 80)

# فحص طلب الشام
print("\n📦 Order 1: الشام (Source)")
print(f"   ID: {ORDER_ALSHAM}")
try:
    order_alsham = ProductOrder.objects.get(id=ORDER_ALSHAM)
    print(f"   ✅ Found")
    print(f"   - Status: {order_alsham.status}")
    print(f"   - Tenant: {order_alsham.tenant_id}")
    print(f"   - External Order ID: {order_alsham.external_order_id}")
    print(f"   - Provider ID: {order_alsham.provider_id}")
    print(f"   - Manual Note: {order_alsham.manual_note[:30] if order_alsham.manual_note else None}...")
except ProductOrder.DoesNotExist:
    print(f"   ❌ Not found")

# فحص طلب شام تيك
print("\n📦 Order 2: شام تيك (Destination)")
print(f"   ID: {ORDER_SHAMTECH}")
try:
    order_shamtech = ProductOrder.objects.get(id=ORDER_SHAMTECH)
    print(f"   ✅ Found")
    print(f"   - Status: {order_shamtech.status}")
    print(f"   - Tenant: {order_shamtech.tenant_id}")
    print(f"   - External Order ID: {order_shamtech.external_order_id}")
    print(f"   - Provider ID: {order_shamtech.provider_id}")
    print(f"   - Manual Note: {order_shamtech.manual_note[:30] if order_shamtech.manual_note else None}...")
    
    # فحص إذا كان external_order_id يشير للطلب الأول
    if order_shamtech.external_order_id == ORDER_ALSHAM:
        print(f"\n✅ Correct Forward Link!")
        print(f"   شام تيك ← الشام")
        
        # فحص إذا كان stub forward
        is_stub = order_shamtech.external_order_id.startswith('stub-')
        print(f"   Is Stub Forward: {is_stub}")
        
        # فحص إذا تم dispatch
        if order_shamtech.status == 'approved' and order_shamtech.manual_note:
            print(f"\n✅ شام تيك Order DISPATCHED!")
            print(f"   Code: {order_shamtech.manual_note}")
        else:
            print(f"\n❌ شام تيك Order NOT DISPATCHED YET")
            print(f"   Status: {order_shamtech.status}")
            print(f"   Manual Note: {order_shamtech.manual_note}")
    else:
        print(f"\n⚠️ Forward link mismatch!")
        print(f"   Expected: {ORDER_ALSHAM}")
        print(f"   Actual: {order_shamtech.external_order_id}")
        
except ProductOrder.DoesNotExist:
    print(f"   ❌ Not found")

print("\n" + "=" * 80)
