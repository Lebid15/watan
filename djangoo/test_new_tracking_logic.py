import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q

print("=" * 80)
print("🔍 اختبار الطلبات التي سيتتبعها العامل الآن")
print("=" * 80)

one_minute_ago = timezone.now() - timedelta(minutes=1)
twenty_four_hours_ago = timezone.now() - timedelta(hours=24)

# الاستعلام الجديد - يتتبع كل الطلبات المرسلة لمزود خارجي
pending_orders = ProductOrder.objects.filter(
    external_order_id__isnull=False,  # تم إرساله لمزود خارجي
    sent_at__isnull=False,
    sent_at__lte=one_minute_ago,
    sent_at__gte=twenty_four_hours_ago
).exclude(
    # استبعاد الحالات النهائية
    Q(external_status__iexact='completed') |
    Q(external_status__iexact='delivered') |
    Q(external_status__iexact='done') |
    Q(external_status__iexact='cancelled') |
    Q(external_status__iexact='canceled') |
    Q(external_status__iexact='failed') |
    Q(external_status__iexact='rejected')
)[:20]

print(f"\n📊 تم العثور على {pending_orders.count()} طلب سيتم تتبعه:")
print("\n" + "=" * 80)

for i, order in enumerate(pending_orders, 1):
    time_waiting = timezone.now() - order.sent_at if order.sent_at else None
    waiting_minutes = int(time_waiting.total_seconds() / 60) if time_waiting else 0
    
    print(f"\n{i}. الطلب: {str(order.id)[:8]}...")
    print(f"   الباقة: {order.package.name if order.package else 'N/A'}")
    print(f"   الحالة: {order.status}")
    print(f"   الحالة الخارجية: {order.external_status or 'N/A'}")
    print(f"   الوضع: {order.mode or 'N/A'}")
    print(f"   المزود: {str(order.provider_id)[:8] if order.provider_id else 'N/A'}...")
    print(f"   External Order ID: {order.external_order_id or 'N/A'}")
    print(f"   تم الإرسال: {order.sent_at}")
    print(f"   ⏱️  في الانتظار: {waiting_minutes} دقيقة")

if pending_orders.count() == 0:
    print("\n⚠️  لا توجد طلبات للتتبع حالياً")
    print("\nالأسباب المحتملة:")
    print("  1. جميع الطلبات في حالة نهائية (completed, cancelled, etc.)")
    print("  2. الطلبات تم إرسالها منذ أقل من دقيقة واحدة")
    print("  3. الطلبات ليس لها external_order_id (لم تُرسل لمزود خارجي)")

print("\n" + "=" * 80)
print("\n✅ الفحص الجديد:")
print("  • يتتبع كل الطلبات المرسلة لمزود خارجي (manual و auto)")
print("  • يتجاهل الطلبات في حالة نهائية فقط")
print("  • يعمل مع أحرف كبيرة/صغيرة (PENDING = pending)")
print("=" * 80)
