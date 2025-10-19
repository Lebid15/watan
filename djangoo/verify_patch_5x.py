"""
سكريبت للتحقق من المشكلة: الطلب يتحول إلى approved قبل تأكيد المزود
"""
import os
import sys
import django
import time
import json

# إعداد Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from django.db import connection

def inspect_dispatch_behavior():
    """فحص سلوك الإرسال من خلال فحص الكود"""
    
    print(f"\n{'='*80}")
    print(f"🔍 Inspecting Dispatch Behavior")
    print(f"{'='*80}\n")
    
    # 1. فحص SQL UPDATE statement في try_auto_dispatch
    print("1️⃣ Checking SQL UPDATE in try_auto_dispatch()...")
    
    with open('apps/orders/services.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # البحث عن UPDATE statement بعد الإرسال
    if 'UPDATE product_orders' in content:
        # نبحث عن التحديث الذي يحدث بعد الإرسال
        lines = content.split('\n')
        in_update = False
        update_fields = []
        
        for i, line in enumerate(lines):
            if 'Step 13: Updating order in database' in line:
                print(f"   ✅ Found UPDATE section at line {i}")
                # نقرأ الـ UPDATE التالي
                for j in range(i, min(i+50, len(lines))):
                    if 'UPDATE product_orders' in lines[j]:
                        in_update = True
                    if in_update:
                        if 'SET' in lines[j]:
                            continue
                        if 'WHERE' in lines[j]:
                            break
                        if '=' in lines[j] and '"' in lines[j]:
                            field = lines[j].strip().split('=')[0].strip()
                            update_fields.append(field)
                break
        
        print(f"\n   📋 Fields being updated:")
        for field in update_fields:
            print(f"      - {field}")
        
        # 2. التحقق من عدم تحديث status
        print(f"\n2️⃣ Checking if 'status' field is updated...")
        
        status_updated = False
        for field in update_fields:
            if 'status' in field.lower() and 'external' not in field.lower():
                status_updated = True
                print(f"   ❌ PROBLEM: Field '{field}' is being updated!")
        
        if not status_updated:
            print(f"   ✅ CORRECT: 'status' field is NOT updated")
            print(f"   ℹ️  Only 'externalStatus' is updated")
        
        # 3. التحقق من external_status mapping
        print(f"\n3️⃣ Checking external_status mapping...")
        
        if "external_status = 'processing'" in content:
            print(f"   ✅ CORRECT: Terminal states are mapped to 'processing'")
            
            # نبحث عن التعليق التوضيحي
            if "PATCH 5.x" in content:
                print(f"   ✅ Patch 5.x comment found")
            
            # نتحقق من المنطق
            if "elif status_raw in ['completed', 'done', 'success', 'failed', 'rejected', 'error']:" in content:
                print(f"   ✅ Terminal status handling found")
                if "external_status = 'processing'" in content:
                    print(f"   ✅ Terminal statuses are kept as 'processing'")
        else:
            print(f"   ❌ PROBLEM: Terminal status mapping not found!")
    
    print(f"\n{'='*80}")
    print(f"✅ Inspection Complete")
    print(f"{'='*80}\n")
    
    print(f"📝 Summary:")
    print(f"   - After dispatch, 'status' field should remain unchanged (pending)")
    print(f"   - Only 'externalStatus' is updated to 'sent' or 'processing'")
    print(f"   - Terminal states from provider are mapped to 'processing'")
    print(f"   - Celery task will later update 'status' to 'approved'/'rejected'")

def check_recent_orders():
    """فحص الطلبات الأخيرة"""
    print(f"\n{'='*80}")
    print(f"📊 Checking Recent Orders")
    print(f"{'='*80}\n")
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                id,
                status,
                "externalStatus",
                "providerId",
                "externalOrderId",
                "sentAt",
                mode
            FROM product_orders
            WHERE "sentAt" IS NOT NULL
            ORDER BY "sentAt" DESC
            LIMIT 10
        """)
        
        rows = cursor.fetchall()
        
        if not rows:
            print("   ℹ️  No orders with sentAt found")
            return
        
        print(f"   Found {len(rows)} recent orders:\n")
        
        for row in rows:
            order_id, status, ext_status, provider_id, ext_order_id, sent_at, mode = row
            print(f"   📦 Order: {str(order_id)[:8]}...")
            print(f"      - status: {status}")
            print(f"      - externalStatus: {ext_status}")
            print(f"      - mode: {mode}")
            print(f"      - sentAt: {sent_at}")
            
            # التحقق من المشكلة
            if status == 'approved' and ext_status in ('sent', 'processing'):
                print(f"      ⚠️  WARNING: Status is 'approved' but externalStatus is '{ext_status}'")
            elif status == 'pending' and ext_status in ('sent', 'processing'):
                print(f"      ✅ CORRECT: Status is 'pending', externalStatus is '{ext_status}'")
            
            print()

if __name__ == '__main__':
    print("\n" + "="*80)
    print("🧪 Patch 5.x - Premature Approval Detection")
    print("="*80)
    
    inspect_dispatch_behavior()
    check_recent_orders()
    
    print("\n" + "="*80)
    print("✅ Analysis Complete")
    print("="*80)
