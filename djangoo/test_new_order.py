"""
اختبار: إنشاء طلب جديد PUBG 660 لـ شام تيك
يجب أن يتم توجيهه تلقائياً إلى Codes provider
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch_async
import uuid
from datetime import datetime

# معرفات الكيانات
TENANT_SHAMTECH = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"  # شام تيك
PACKAGE_PUBG660 = "9d94aa49-6c7a-4dd2-bbfd-a8ed3c7079d9"  # PUBG 660
PRODUCT_PUBG = "b8c30a6d-76c8-4a18-9079-d8c892168c96"  # PUBG UC

print("=" * 80)
print("🧪 TEST: Creating new PUBG 660 order for شام تيك")
print("=" * 80)

# 1. إنشاء طلب جديد
order_id = str(uuid.uuid4())

print(f"\n📝 Step 1: Creating order...")
print(f"   Order ID: {order_id}")

order = ProductOrder.objects.create(
    id=order_id,
    tenant_id=TENANT_SHAMTECH,
    package_id=PACKAGE_PUBG660,
    product_id=PRODUCT_PUBG,
    user_identifier="test123",
    extra_field="test123",
    quantity=1,
    status='pending',
    price=100.00,
    sell_price_amount=100.00,
    sell_price_currency='USD',
    created_at=datetime.now(),
    notes=[],
    user_id=None  # طلب عام بدون مستخدم
)

print(f"✅ Order created!")
print(f"   Status: {order.status}")
print(f"   Package: {order.package_id}")

# 2. محاولة التوجيه التلقائي
print(f"\n🚀 Step 2: Triggering auto-dispatch...")
result = try_auto_dispatch_async(str(order.id), str(TENANT_SHAMTECH))

print(f"\n📊 Auto-dispatch result:")
print(f"   {result}")

# 3. فحص حالة الطلب بعد التوجيه
print(f"\n🔍 Step 3: Checking order status after dispatch...")
order.refresh_from_db()

print(f"\n📦 Order Status:")
print(f"   ID: {order.id}")
print(f"   Status: {order.status}")
print(f"   Provider ID: {order.provider_id}")
print(f"   External Order ID: {order.external_order_id}")
print(f"   Manual Note: {order.manual_note[:50] if order.manual_note else None}...")

# 4. النتيجة
print(f"\n{'=' * 80}")
if order.status == 'approved' and order.manual_note:
    print(f"✅ SUCCESS: Order was auto-dispatched!")
    print(f"   Code: {order.manual_note}")
elif order.status == 'pending':
    print(f"❌ FAILED: Order is still pending!")
    print(f"   This means auto-dispatch didn't work")
else:
    print(f"⚠️ UNEXPECTED: Order status is {order.status}")
print(f"{'=' * 80}\n")
