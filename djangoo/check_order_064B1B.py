"""
فحص الطلب 064B1B للتأكد من جاهزيته لإعادة التوجيه إلى shamtech
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# البحث عن الطلب بالرقم المختصر
ORDER_SHORT_ID = "064B1B"

print("=" * 80)
print(f"🔍 البحث عن الطلب {ORDER_SHORT_ID}")
print("=" * 80)

# البحث في قاعدة البيانات
from django.db import connection

with connection.cursor() as cursor:
    # البحث عن الطلب الذي ينتهي معرّفه بـ 064B1B
    cursor.execute("""
        SELECT id, status, "providerId", "externalOrderId", "externalStatus", mode,
               "userId", "packageId", price, "userIdentifier", "extraField"
        FROM product_orders
        WHERE LOWER(RIGHT(id::text, 6)) = LOWER(%s)
        ORDER BY "createdAt" DESC
        LIMIT 1
    """, [ORDER_SHORT_ID])
    
    row = cursor.fetchone()
    
    if row:
        order_id = row[0]
        print(f"✅ تم العثور على الطلب!")
        print(f"\n📦 معلومات الطلب:")
        print(f"   - Full ID: {order_id}")
        print(f"   - Short ID: {str(order_id)[-6:].upper()}")
        print(f"   - Status: {row[1]}")
        print(f"   - Provider ID: {row[2] or 'NULL'}")
        print(f"   - External Order ID: {row[3] or 'NULL'}")
        print(f"   - External Status: {row[4] or 'NULL'}")
        print(f"   - Mode: {row[5] or 'NULL'}")
        print(f"   - Price: ${row[8]}")
        print(f"   - User Identifier: {row[9] or 'N/A'}")
        print(f"   - Extra Field: {row[10] or 'N/A'}")
        
        # فحص إمكانية إعادة التوجيه
        print(f"\n🔎 فحص إمكانية إعادة التوجيه:")
        status = row[1]
        provider_id = row[2]
        external_order_id = row[3]
        
        print(f"   1. status == 'pending' ? {status == 'pending'}")
        print(f"   2. provider_id is NULL ? {provider_id is None}")
        print(f"   3. external_order_id is NULL ? {external_order_id is None}")
        
        can_reroute = (status == 'pending')
        
        if can_reroute:
            print(f"\n✅ الطلب جاهز لإعادة التوجيه!")
            print(f"   يمكن إرساله إلى shamtech (diana)")
        else:
            print(f"\n❌ الطلب لا يمكن إعادة توجيهه")
            print(f"   السبب: status = '{status}' (يجب أن يكون 'pending')")
        
        # حفظ المعرف للاستخدام
        print(f"\n📋 للاستخدام في السكريبت التالي:")
        print(f"   ORDER_ID = \"{order_id}\"")
        
    else:
        print(f"❌ لم يتم العثور على الطلب {ORDER_SHORT_ID}")
        
        # البحث عن طلبات halil الأخيرة
        print(f"\n🔍 البحث عن طلبات halil الأخيرة...")
        cursor.execute("""
            SELECT id, status, "createdAt"
            FROM product_orders po
            INNER JOIN users u ON po."userId" = u.id
            WHERE u.username = 'halil'
            AND po."tenantId" = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
            ORDER BY po."createdAt" DESC
            LIMIT 5
        """)
        
        orders = cursor.fetchall()
        if orders:
            print(f"   وجدت {len(orders)} طلب:")
            for o in orders:
                print(f"   - {str(o[0])[-6:].upper()}: {o[1]} ({o[2]})")

print("\n" + "=" * 80)
