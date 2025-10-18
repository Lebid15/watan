"""
فحص الطلبات الحقيقية من Frontend
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# الطلبات من الاختبار الحقيقي
ORDER_KHALIL_ALSHAM = "F73048"  # طلب خليل عند الشام
ORDER_DIANA_SHAMTECH = "4ADEFA"  # طلب ديانا عند شام تيك

print("=" * 100)
print("🔍 Checking Real Test Orders from Frontend")
print("=" * 100)

# البحث بـ order_no (الرقم المختصر)
print("\n📦 Searching by order_no...")

orders = ProductOrder.objects.filter(
    order_no__in=[
        int("0x" + ORDER_KHALIL_ALSHAM, 16),  # تحويل hex إلى int
        int("0x" + ORDER_DIANA_SHAMTECH, 16)
    ]
).order_by('created_at')

print(f"   Found {orders.count()} orders\n")

for i, order in enumerate(orders, 1):
    order_hex = f"{order.order_no:X}" if order.order_no else "N/A"
    
    print(f"{'=' * 100}")
    print(f"📦 Order {i}: {order_hex}")
    print(f"{'=' * 100}")
    print(f"   ID: {order.id}")
    print(f"   Order No (hex): {order_hex}")
    print(f"   Order No (int): {order.order_no}")
    print(f"   Tenant: {order.tenant_id}")
    print(f"   Status: {order.status}")
    print(f"   Created: {order.created_at}")
    print(f"   Package: {order.package_id}")
    print(f"   Product: {order.product_id}")
    print(f"   User Identifier: {order.user_identifier}")
    print(f"   Extra Field: {order.extra_field}")
    print(f"   Provider ID: {order.provider_id}")
    print(f"   External Order ID: {order.external_order_id}")
    print(f"   Manual Note: {order.manual_note[:50] if order.manual_note else None}...")
    print(f"   External Status: {order.external_status}")
    print()

# فحص العلاقة بين الطلبين
print("=" * 100)
print("🔗 Checking Forward Relationship")
print("=" * 100)

if orders.count() >= 2:
    order1 = orders[0]
    order2 = orders[1]
    
    order1_hex = f"{order1.order_no:X}" if order1.order_no else "N/A"
    order2_hex = f"{order2.order_no:X}" if order2.order_no else "N/A"
    
    # فحص إذا كان order1 يشير إلى order2
    if str(order1.external_order_id) == str(order2.id):
        print(f"✅ Forward: {order1_hex} → {order2_hex}")
        print(f"   {order1_hex} forwarded to {order2_hex}")
    elif str(order2.external_order_id) == str(order1.id):
        print(f"✅ Forward: {order2_hex} → {order1_hex}")
        print(f"   {order2_hex} forwarded to {order1_hex}")
    else:
        print(f"⚠️ No direct forward relationship found")
        print(f"   Order 1 external_order_id: {order1.external_order_id}")
        print(f"   Order 2 external_order_id: {order2.external_order_id}")

# فحص النتيجة النهائية
print("\n" + "=" * 100)
print("📊 FINAL RESULT")
print("=" * 100)

shamtech_order = None
alsham_order = None

for order in orders:
    # تحديد الطلب حسب tenant
    if str(order.tenant_id) == "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536":
        shamtech_order = order
    elif str(order.tenant_id) == "7d37f00a-22f3-4e61-88d7-2a97b79d86fb":
        alsham_order = order

if shamtech_order:
    print(f"\n📦 شام تيك Order (4ADEFA):")
    print(f"   Status: {shamtech_order.status}")
    print(f"   Manual Note: {shamtech_order.manual_note[:50] if shamtech_order.manual_note else None}...")
    
    if shamtech_order.status == 'approved' and shamtech_order.manual_note:
        print(f"   ✅ SUCCESS: Auto-dispatched with code!")
    elif shamtech_order.status == 'pending':
        print(f"   ❌ FAILED: Still pending, auto-dispatch didn't work")
    else:
        print(f"   ⚠️ UNEXPECTED: Status is {shamtech_order.status}")

if alsham_order:
    print(f"\n📦 الشام Order (F73048):")
    print(f"   Status: {alsham_order.status}")
    print(f"   External Order ID: {alsham_order.external_order_id}")
    
    if alsham_order.status == 'rejected':
        print(f"   ✅ Correctly rejected after forward")
    else:
        print(f"   ⚠️ Status: {alsham_order.status}")

print("\n" + "=" * 100)
