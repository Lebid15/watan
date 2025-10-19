"""
اختبار السيناريو الكامل بعد إصلاح base_url

السيناريو:
1. خليل (alsham) → يرسل طلب → Manual
2. alsham → يعيد التوجيه إلى diana
3. diana → ينشئ طلب جديد Manual (بدون provider_id)
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from apps.orders.models import ProductOrder
from apps.products.models import ProductPackage
from apps.users.models import LegacyUser
from django.utils import timezone
import uuid

print("="*80)
print("إنشاء طلب جديد لاختبار السيناريو الكامل")
print("="*80)

# 1. إنشاء طلب في alsham
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
halil_user_id = '7a73edd8-183f-4fbd-a07b-6863b3f6b842'

# البحث عن باقة pubg global 180
package = ProductPackage.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='pubg global 180'
).first()

if not package:
    print("❌ لم أجد الباقة!")
    exit(1)

print(f"\n📦 الباقة:")
print(f"   ID: {package.id}")
print(f"   Name: {package.name}")

# إنشاء الطلب
order_id = uuid.uuid4()
short_id = str(order_id).split('-')[0].upper()

order = ProductOrder.objects.create(
    id=order_id,
    tenant_id=alsham_tenant_id,
    user_id=halil_user_id,
    product_id=package.product_id,
    package_id=package.id,
    quantity=1,
    user_identifier='546454',
    extra_field='55',
    status='PENDING',
    sell_price_amount=5.5,
    price=4.5,
    sell_price_currency='USD',
    external_status='not_sent',
    created_at=timezone.now(),
    notes=[],
    notes_count=0,
)

print(f"\n✅ تم إنشاء الطلب:")
print(f"   Order ID: {order.id}")
print(f"   Short ID: {short_id}")
print(f"   Status: {order.status}")
print(f"   Provider ID: {order.provider_id}")

print("\n" + "="*80)
print(f"🎯 الآن: انتقل إلى alsham وأعد توجيه الطلب {short_id} إلى diana")
print("="*80)
