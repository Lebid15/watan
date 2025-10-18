"""
اختبار السيناريو الكامل:
1. إنشاء طلب في الشام
2. Forward إلى شام تيك
3. فحص إذا تم auto-dispatch تلقائياً
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.views import AdminOrdersBulkDispatchView
from apps.providers.models import Integration
import uuid
from datetime import datetime
from django.test import RequestFactory

# معرفات الكيانات
TENANT_ALSHAM = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"  # الشام
TENANT_SHAMTECH = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"  # شام تيك
PACKAGE_PUBG660 = "9d94aa49-6c7a-4dd2-bbfd-a8ed3c7079d9"  # PUBG 660
PRODUCT_PUBG = "b8c30a6d-76c8-4a18-9079-d8c892168c96"  # PUBG UC
PROVIDER_SHAMTECH = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"  # Diana (شام تيك)

print("=" * 100)
print("🧪 FULL SCENARIO TEST: الشام → Forward → شام تيك → Auto-Dispatch")
print("=" * 100)

# ========================================
# Step 1: إنشاء طلب في الشام
# ========================================
print("\n📝 STEP 1: Creating order in الشام...")

order_alsham_id = str(uuid.uuid4())
order_alsham = ProductOrder.objects.create(
    id=order_alsham_id,
    tenant_id=TENANT_ALSHAM,
    package_id=PACKAGE_PUBG660,
    product_id=PRODUCT_PUBG,
    user_identifier="khalil123",
    extra_field="khalil123",
    quantity=1,
    status='pending',
    price=150.00,
    sell_price_amount=150.00,
    sell_price_currency='USD',
    created_at=datetime.now(),
    notes=[],
    user_id=None
)

print(f"✅ Order created in الشام")
print(f"   ID: {order_alsham_id[:8]}...")
print(f"   Status: {order_alsham.status}")

# ========================================
# Step 2: Forward إلى شام تيك
# ========================================
print(f"\n🔀 STEP 2: Forwarding to شام تيك (Diana provider)...")

# إنشاء طلب الـ forward في شام تيك
order_shamtech_id = str(uuid.uuid4())
order_shamtech = ProductOrder.objects.create(
    id=order_shamtech_id,
    tenant_id=TENANT_SHAMTECH,
    package_id=PACKAGE_PUBG660,
    product_id=PRODUCT_PUBG,
    user_identifier="khalil123",
    extra_field="khalil123",
    quantity=1,
    status='pending',
    price=100.00,  # سعر أقل عند شام تيك
    sell_price_amount=100.00,
    sell_price_currency='USD',
    created_at=datetime.now(),
    notes=[],
    external_order_id=order_alsham_id,  # الربط بطلب الشام
    user_id=None
)

print(f"✅ Forward order created in شام تيك")
print(f"   ID: {order_shamtech_id[:8]}...")
print(f"   External Order ID: {order_shamtech.external_order_id[:8]}...")

# تحديث طلب الشام
order_alsham.provider_id = PROVIDER_SHAMTECH
order_alsham.external_order_id = order_shamtech_id
order_alsham.status = 'rejected'  # تم رفضه محلياً وإرساله للمزود
order_alsham.save()

print(f"✅ الشام order updated")
print(f"   Provider: Diana")
print(f"   External Order: {order_alsham.external_order_id[:8]}...")
print(f"   Status: {order_alsham.status}")

# ========================================
# Step 3: محاولة Auto-Dispatch
# ========================================
print(f"\n🚀 STEP 3: Should trigger auto-dispatch for شام تيك order...")

# محاكاة ما يحدث في AdminOrdersBulkDispatchView بعد Forward
# السطور 962-978 تستدعي try_auto_dispatch_async
from apps.orders.services import try_auto_dispatch_async

print(f"   Calling try_auto_dispatch_async...")
result = try_auto_dispatch_async(str(order_shamtech_id), str(TENANT_SHAMTECH))

print(f"\n📊 Auto-dispatch result:")
print(f"   {result}")

# ========================================
# Step 4: فحص النتيجة
# ========================================
print(f"\n🔍 STEP 4: Checking final status...")

order_alsham.refresh_from_db()
order_shamtech.refresh_from_db()

print(f"\n📦 الشام Order:")
print(f"   ID: {order_alsham.id}")
print(f"   Status: {order_alsham.status}")
print(f"   Provider: {order_alsham.provider_id}")
print(f"   External Order: {order_alsham.external_order_id[:8]}...")

print(f"\n📦 شام تيك Order:")
print(f"   ID: {order_shamtech.id}")
print(f"   Status: {order_shamtech.status}")
print(f"   External Order: {order_shamtech.external_order_id[:8]}...")
print(f"   Manual Note: {order_shamtech.manual_note[:30] if order_shamtech.manual_note else None}...")

# ========================================
# النتيجة النهائية
# ========================================
print(f"\n{'=' * 100}")
if order_shamtech.status == 'approved' and order_shamtech.manual_note:
    print(f"✅ SUCCESS! Full scenario works!")
    print(f"   الشام → Forward → شام تيك → Auto-Dispatch → Code: {order_shamtech.manual_note}")
elif order_shamtech.status == 'pending':
    print(f"❌ FAILED! شام تيك order is still pending")
    print(f"   Auto-dispatch did not work after forward")
else:
    print(f"⚠️ UNEXPECTED STATUS: {order_shamtech.status}")
print(f"{'=' * 100}\n")
