"""
فحص الطلب E69E1F
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

# البحث عن الطلب
with connection.cursor() as c:
    c.execute("""
        SELECT id, status, "tenantId", "packageId", "providerId", "externalOrderId", "manualNote"
        FROM product_orders
        WHERE id::text LIKE '%e69e1f%'
        ORDER BY "createdAt" DESC
        LIMIT 1
    """)
    
    row = c.fetchone()
    
    if row:
        print("=" * 80)
        print("📦 Order E69E1F Details:")
        print("=" * 80)
        print(f"   ID: {row[0]}")
        print(f"   Status: {row[1]}")
        print(f"   Tenant: {row[2]}")
        print(f"   Package: {row[3]}")
        print(f"   Provider: {row[4]}")
        print(f"   External Order: {row[5]}")
        print(f"   Manual Note: {row[6][:50] if row[6] else None}...")
        
        order_id = row[0]
        package_id = row[3]
        tenant_id = row[2]
        
        # فحص routing
        print("\n" + "=" * 80)
        print("⚙️ Checking PackageRouting:")
        print("=" * 80)
        
        c.execute("""
            SELECT mode, "providerType", "codeGroupId", "primaryProviderId"
            FROM package_routing
            WHERE package_id = %s AND "tenantId" = %s
        """, [package_id, tenant_id])
        
        routing = c.fetchone()
        
        if routing:
            print(f"   ✅ Routing found!")
            print(f"   - Mode: {routing[0]}")
            print(f"   - Provider Type: {routing[1]}")
            print(f"   - Code Group ID: {routing[2]}")
            print(f"   - Primary Provider ID: {routing[3]}")
        else:
            print(f"   ❌ No routing configured!")
        
        print("\n" + "=" * 80)
        print("💡 Solution:")
        print("=" * 80)
        print("   Run: python dispatch_order.py <order_id>")
        print(f"   Example: python dispatch_order.py {order_id}")
        print("=" * 80)
    else:
        print("❌ Order not found!")
