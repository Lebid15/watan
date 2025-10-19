import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')

import django
django.setup()

from django.db import connection

print("\n" + "="*80)
print("Checking Code for Premature Approval Issue")
print("="*80 + "\n")

# 1. فحص الكود
print("1. Checking if 'status' field is updated in dispatch...")
with open('apps/orders/services.py', 'r', encoding='utf-8') as f:
    content = f.read()
    
    # البحث عن UPDATE بعد Step 13
    if 'Step 13: Updating order in database' in content:
        idx = content.find('Step 13: Updating order in database')
        update_section = content[idx:idx+2000]
        
        if '"status"' in update_section and 'UPDATE product_orders' in update_section:
            # التحقق من أن status ليس في UPDATE
            update_start = update_section.find('UPDATE product_orders')
            where_clause = update_section.find('WHERE', update_start)
            update_fields = update_section[update_start:where_clause]
            
            if '"status" =' in update_fields or 'status =' in update_fields:
                print("   ❌ PROBLEM: 'status' field IS being updated!")
            else:
                print("   ✅ CORRECT: 'status' field is NOT in UPDATE statement")
        else:
            print("   ✅ CORRECT: 'status' field is NOT in UPDATE statement")

# 2. فحص terminal status mapping
print("\n2. Checking terminal status mapping...")
if "PATCH 5.x: Never set terminal status on dispatch" in content:
    print("   ✅ Patch 5.x comment found")
    
if "elif status_raw in ['completed', 'done', 'success', 'failed', 'rejected', 'error']:" in content:
    print("   ✅ Terminal status check found")
    # نتحقق من أن external_status يتم تعيينه إلى processing
    idx = content.find("elif status_raw in ['completed', 'done', 'success', 'failed', 'rejected', 'error']:")
    next_lines = content[idx:idx+300]
    if "external_status = 'processing'" in next_lines:
        print("   ✅ Terminal statuses are mapped to 'processing'")
    else:
        print("   ❌ PROBLEM: Terminal statuses are NOT mapped to 'processing'")

# 3. فحص الطلبات الأخيرة
print("\n3. Checking recent orders in database...")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT id, status, "externalStatus", "sentAt"::text
        FROM product_orders
        WHERE "sentAt" IS NOT NULL
        ORDER BY "sentAt" DESC
        LIMIT 5
    """)
    rows = cursor.fetchall()
    
    if rows:
        print(f"   Found {len(rows)} recent orders:\n")
        for row in rows:
            order_id, status, ext_status, sent_at = row
            print(f"   Order {str(order_id)[:13]}...")
            print(f"      status: {status}, externalStatus: {ext_status}")
            
            # Check for the issue
            if status == 'approved' and ext_status in ('sent', 'processing', 'not_sent'):
                print(f"      ⚠️  Potential issue: approved but external is {ext_status}")
    else:
        print("   No orders found")

print("\n" + "="*80)
print("Verification Complete")
print("="*80)
