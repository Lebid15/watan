"""
فحص تفصيلي للطلبين F73048 و 4ADEFA
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# الطلبات المحددة بناءً على UUID
ORDER_ALSHAM_ID = "347b7ab0-8e2b-4280-836c-49a910f73048"  # F73048
ORDER_SHAMTECH_ID = "d2de8004-3d98-4dfc-8d39-e3ca254adefa"  # 4ADEFA

print("=" * 100)
print("🔍 Detailed Check: F73048 and 4ADEFA Orders")
print("=" * 100)

# طلب الشام
print("\n📦 Order 1: الشام (F73048)")
print(f"   ID: {ORDER_ALSHAM_ID}")
try:
    order_alsham = ProductOrder.objects.get(id=ORDER_ALSHAM_ID)
    print(f"   ✅ Found")
    print(f"   Tenant: {order_alsham.tenant_id}")
    print(f"   Status: {order_alsham.status}")
    print(f"   Created: {order_alsham.created_at}")
    print(f"   Package: {order_alsham.package_id}")
    print(f"   Provider: {order_alsham.provider_id}")
    print(f"   External Order ID: {order_alsham.external_order_id}")
    print(f"   Manual Note: {order_alsham.manual_note}")
except ProductOrder.DoesNotExist:
    print(f"   ❌ Not found")

# طلب شام تيك
print("\n📦 Order 2: شام تيك (4ADEFA)")
print(f"   ID: {ORDER_SHAMTECH_ID}")
try:
    order_shamtech = ProductOrder.objects.get(id=ORDER_SHAMTECH_ID)
    print(f"   ✅ Found")
    print(f"   Tenant: {order_shamtech.tenant_id}")
    print(f"   Status: {order_shamtech.status}")
    print(f"   Created: {order_shamtech.created_at}")
    print(f"   Package: {order_shamtech.package_id}")
    print(f"   Provider: {order_shamtech.provider_id}")
    print(f"   External Order ID: {order_shamtech.external_order_id}")
    print(f"   Manual Note: {order_shamtech.manual_note}")
except ProductOrder.DoesNotExist:
    print(f"   ❌ Not found")

# فحص العلاقة
print("\n" + "=" * 100)
print("🔗 Forward Relationship Check")
print("=" * 100)

if order_alsham.external_order_id == ORDER_SHAMTECH_ID:
    print(f"✅ CORRECT: الشام → شام تيك")
    print(f"   الشام forwarded to شام تيك")
else:
    print(f"❌ WRONG: Forward link mismatch")
    print(f"   Expected: {ORDER_SHAMTECH_ID}")
    print(f"   Actual: {order_alsham.external_order_id}")

# فحص Routing
print("\n" + "=" * 100)
print("⚙️ Checking PackageRouting for شام تيك")
print("=" * 100)

from apps.providers.models import PackageRouting

try:
    routing = PackageRouting.objects.get(
        package_id=order_shamtech.package_id,
        tenant_id=order_shamtech.tenant_id
    )
    print(f"✅ Routing found")
    print(f"   Mode: {routing.mode}")
    print(f"   Provider Type: {routing.provider_type}")
    print(f"   Code Group: {routing.code_group_id}")
except PackageRouting.DoesNotExist:
    print(f"❌ No routing configured!")

# فحص الأكواد
if routing and routing.code_group_id:
    from apps.codes.models import CodeGroup
    try:
        code_group = CodeGroup.objects.get(id=routing.code_group_id)
        total = code_group.items.count()
        used = code_group.items.filter(status='used').count()
        available = code_group.items.filter(status='available').count()
        
        print(f"\n📊 Code Group Status:")
        print(f"   Name: {code_group.name}")
        print(f"   Total: {total}")
        print(f"   Used: {used}")
        print(f"   Available: {available}")
    except:
        pass

# النتيجة
print("\n" + "=" * 100)
print("📊 DIAGNOSIS")
print("=" * 100)

if order_shamtech.status == 'pending':
    print(f"\n❌ PROBLEM FOUND!")
    print(f"   شام تيك order is PENDING")
    print(f"   Auto-dispatch did NOT work!")
    print(f"\n🔍 Possible reasons:")
    print(f"   1. Forward operation didn't trigger auto-dispatch")
    print(f"   2. Auto-dispatch was called but failed silently")
    print(f"   3. Routing configuration issue")
    
    # التحقق من stub forward
    if order_shamtech.external_order_id and order_shamtech.external_order_id.startswith('stub-'):
        print(f"   4. ⚠️ This is a stub forward!")
    else:
        print(f"   4. External order ID exists: {order_shamtech.external_order_id}")
        
elif order_shamtech.status == 'approved':
    print(f"\n✅ SUCCESS!")
    print(f"   شام تيك order was dispatched")
    print(f"   Code: {order_shamtech.manual_note}")
else:
    print(f"\n⚠️ Unexpected status: {order_shamtech.status}")

print("\n" + "=" * 100)
