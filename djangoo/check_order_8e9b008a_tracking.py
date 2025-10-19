import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from datetime import timedelta
from django.utils import timezone

print("=" * 80)
print("🔍 فحص الطلب 8e9b008a")
print("=" * 80)

order = ProductOrder.objects.filter(id__startswith='8e9b008a').first()

if order:
    print(f"\n✅ تم العثور على الطلب:")
    print(f"  ID: {order.id}")
    print(f"  الباقة: {order.package.name if order.package else 'N/A'}")
    print(f"  الحالة: {order.status}")
    print(f"  الحالة الخارجية: {order.external_status or 'NULL'}")
    print(f"  الوضع: {order.mode or 'NULL'}")
    print(f"  External Order ID: {order.external_order_id or 'NULL'}")
    print(f"  Provider ID: {order.provider_id or 'NULL'}")
    print(f"  Sent At: {order.sent_at or 'NULL'}")
    print(f"  Created At: {order.created_at}")
    
    print(f"\n🔍 فحص الشروط للتتبع:")
    
    # 1. External Order ID
    print(f"\n1. External Order ID موجود؟")
    if order.external_order_id:
        print(f"   ✅ نعم: {order.external_order_id}")
    else:
        print(f"   ❌ لا - الطلب لم يُرسل لمزود خارجي بعد")
    
    # 2. Sent At
    print(f"\n2. Sent At موجود؟")
    if order.sent_at:
        print(f"   ✅ نعم: {order.sent_at}")
        
        one_minute_ago = timezone.now() - timedelta(minutes=1)
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        time_diff = timezone.now() - order.sent_at
        minutes_ago = int(time_diff.total_seconds() / 60)
        
        print(f"\n3. تم الإرسال منذ أكثر من دقيقة؟")
        if order.sent_at <= one_minute_ago:
            print(f"   ✅ نعم (منذ {minutes_ago} دقيقة)")
        else:
            print(f"   ❌ لا (منذ {int(time_diff.total_seconds())} ثانية فقط)")
        
        print(f"\n4. تم الإرسال خلال آخر 24 ساعة؟")
        if order.sent_at >= twenty_four_hours_ago:
            print(f"   ✅ نعم")
        else:
            print(f"   ❌ لا (أكثر من 24 ساعة)")
    else:
        print(f"   ❌ لا")
    
    # 3. Final State
    print(f"\n5. الحالة نهائية؟")
    final_statuses = ['completed', 'delivered', 'cancelled', 'canceled', 'failed', 'rejected', 'done']
    if order.external_status and order.external_status.lower() in final_statuses:
        print(f"   ✅ نعم - الطلب في حالة نهائية: {order.external_status}")
        print(f"   ⚠️  لن يتم تتبعه")
    else:
        print(f"   ❌ لا - الطلب يحتاج للتتبع")
    
    print(f"\n" + "=" * 80)
    print("📊 الخلاصة:")
    
    will_track = (
        order.external_order_id and
        order.sent_at and
        order.sent_at <= one_minute_ago and
        order.sent_at >= twenty_four_hours_ago and
        not (order.external_status and order.external_status.lower() in final_statuses)
    )
    
    if will_track:
        print("  ✅ الطلب سيتم تتبعه بواسطة العامل!")
    else:
        print("  ❌ الطلب لن يتم تتبعه")
        print("\n  الأسباب:")
        if not order.external_order_id:
            print("    - ليس له external_order_id")
        if not order.sent_at:
            print("    - ليس له sent_at")
        elif order.sent_at > one_minute_ago:
            print("    - تم إرساله منذ أقل من دقيقة")
        elif order.sent_at < twenty_four_hours_ago:
            print("    - مر عليه أكثر من 24 ساعة")
        if order.external_status and order.external_status.lower() in final_statuses:
            print("    - في حالة نهائية")
    
    print("=" * 80)
else:
    print("\n❌ لم يتم العثور على الطلب!")
