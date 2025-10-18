"""
البحث عن الطلبات بأرقامها المختصرة
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from django.db import connection

print("=" * 100)
print("🔍 Searching for orders F73048 and 4ADEFA")
print("=" * 100)

# البحث بـ SQL مباشر لأن order_no قد يكون مخزن بشكل مختلف
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id,
            "orderNo",
            "tenantId",
            status,
            "createdAt",
            "externalOrderId",
            "providerId",
            "manualNote"
        FROM product_orders
        WHERE "createdAt" > NOW() - INTERVAL '1 hour'
        ORDER BY "createdAt" DESC
        LIMIT 10
    """)
    
    rows = cursor.fetchall()
    
    print(f"\n📊 Last 10 orders in the last hour:")
    print(f"   Found {len(rows)} orders\n")
    
    for row in rows:
        order_id, order_no, tenant_id, status, created_at, external_order_id, provider_id, manual_note = row
        
        # تحويل order_no إلى hex
        order_hex = f"{order_no:X}" if order_no else "N/A"
        
        print(f"{'=' * 80}")
        print(f"   Order: {order_hex} (decimal: {order_no})")
        print(f"   ID: {order_id}")
        print(f"   Tenant: {tenant_id}")
        print(f"   Status: {status}")
        print(f"   Created: {created_at}")
        print(f"   External Order: {external_order_id}")
        print(f"   Provider: {provider_id}")
        print(f"   Manual Note: {manual_note[:30] if manual_note else None}...")
        print()

print("\n" + "=" * 100)
print("🔍 Now searching specifically for F73048 and 4ADEFA")
print("=" * 100)

# تحويل hex إلى decimal
try:
    order_f73048 = int("F73048", 16)
    order_4adefa = int("4ADEFA", 16)
    
    print(f"\n   F73048 = {order_f73048} (decimal)")
    print(f"   4ADEFA = {order_4adefa} (decimal)")
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                id,
                "orderNo",
                "tenantId",
                status,
                "createdAt",
                "externalOrderId",
                "providerId",
                "manualNote"
            FROM product_orders
            WHERE "orderNo" IN (%s, %s)
            ORDER BY "createdAt"
        """, [order_f73048, order_4adefa])
        
        rows = cursor.fetchall()
        
        print(f"\n   Found {len(rows)} matching orders\n")
        
        for row in rows:
            order_id, order_no, tenant_id, status, created_at, external_order_id, provider_id, manual_note = row
            order_hex = f"{order_no:X}"
            
            print(f"{'=' * 80}")
            print(f"📦 Order: {order_hex}")
            print(f"   ID: {order_id}")
            print(f"   Tenant: {tenant_id}")
            print(f"   Status: {status}")
            print(f"   Created: {created_at}")
            print(f"   External Order: {external_order_id}")
            print(f"   Provider: {provider_id}")
            print(f"   Manual Note: {manual_note[:50] if manual_note else None}...")
            print()
            
except ValueError as e:
    print(f"   ❌ Error converting hex: {e}")

print("=" * 100)
