"""
فحص حالة الطلب الجديد للتأكد من إمكانية إعادة توجيهه
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# رقم الطلب الجديد
ORDER_ID = "e654be8c-7ed5-4fe9-a1aa-a2612f0014a7"

print("=" * 80)
print("🔍 فحص حالة الطلب للتأكد من إمكانية إعادة التوجيه")
print("=" * 80)

try:
    order = ProductOrder.objects.get(id=ORDER_ID)
    
    print(f"\n📦 الطلب: {str(order.id)[-6:].upper()}")
    print(f"\n🔎 فحص الحالة:")
    print(f"   - status = '{order.status}' (نوع: {type(order.status).__name__})")
    print(f"   - status.lower() = '{order.status.lower() if order.status else None}'")
    print(f"   - status == 'pending' ? {order.status == 'pending'}")
    print(f"   - status.lower() == 'pending' ? {order.status.lower() == 'pending' if order.status else False}")
    
    print(f"\n🔗 معلومات التوجيه:")
    print(f"   - provider_id = '{order.provider_id or 'NULL'}'")
    print(f"   - external_order_id = '{order.external_order_id or 'NULL'}'")
    print(f"   - external_status = '{order.external_status or 'NULL'}'")
    print(f"   - mode = '{order.mode or 'NULL'}'")
    
    # فحص الشروط
    print(f"\n✅ فحص الشروط:")
    
    # الشرط 1: status != 'pending'
    condition_1 = order.status != 'pending'
    print(f"   1. status != 'pending' ? {condition_1}")
    if condition_1:
        print(f"      ❌ سيفشل! (الحالة: '{order.status}')")
    else:
        print(f"      ✅ سينجح")
    
    # الشرط 2: case-insensitive check
    condition_2 = order.status.lower() != 'pending' if order.status else True
    print(f"   2. status.lower() != 'pending' ? {condition_2}")
    if condition_2:
        print(f"      ❌ سيفشل!")
    else:
        print(f"      ✅ سينجح")
    
    print(f"\n💡 الخلاصة:")
    if order.status and order.status.lower() == 'pending':
        if order.status == 'pending':
            print(f"   ✅ الطلب جاهز لإعادة التوجيه (status='pending' بالأحرف الصغيرة)")
        else:
            print(f"   ⚠️  الطلب جاهز BUT status='{order.status}' (ليس بالأحرف الصغيرة)")
            print(f"   🔧 يحتاج تصحيح في الكود لدعم case-insensitive comparison")
    else:
        print(f"   ❌ الطلب لا يمكن إعادة توجيهه (status='{order.status}')")
    
except ProductOrder.DoesNotExist:
    print(f"❌ الطلب غير موجود: {ORDER_ID}")

print("\n" + "=" * 80)
