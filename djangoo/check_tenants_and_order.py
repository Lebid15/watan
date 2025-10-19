import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

print("=" * 80)
print("🔍 Checking All Tenants and Their Domains")
print("=" * 80)

cursor.execute('''
    SELECT 
        t.id, 
        t.name,
        t.slug,
        d.domain
    FROM tenants t
    LEFT JOIN tenant_domains d ON d."tenantId" = t.id
    WHERE t.name IN ('halil', 'alsham', 'shamtech', 'diana')
    ORDER BY t.name
''')

tenants = cursor.fetchall()

for tenant in tenants:
    print(f"\n  Tenant: {tenant[1]}")
    print(f"    ID: {tenant[0]}")
    print(f"    Slug: {tenant[2]}")
    print(f"    Domain: {tenant[3] or 'NO DOMAIN SET'}")

# Check the PENDING order in alsham
print("\n" + "=" * 80)
print("🔍 Checking Order 65f86844 in ALSHAM")
print("=" * 80)

cursor.execute('''
    SELECT 
        id, "tenantId", order_no, status, mode, 
        provider_id, external_order_id, "createdAt"
    FROM product_orders
    WHERE id::text LIKE '65f86844%'
''')

order = cursor.fetchone()
if order:
    print(f"\n  ✅ Found order:")
    print(f"    Order ID: {order[0]}")
    print(f"    Tenant ID: {order[1]}")
    print(f"    Order No: {order[2]}")
    print(f"    Status: {order[3]}")
    print(f"    Mode: {order[4]}")
    print(f"    Provider ID: {order[5] or 'NOT SET'}")
    print(f"    External Order ID: {order[6] or 'NOT SET'}")
    print(f"    Created: {order[7]}")
    
    print(f"\n  💡 This order:")
    if not order[5]:
        print(f"    ❌ Has NOT been dispatched yet (provider_id is NULL)")
        print(f"    📝 Celery won't check it until it's dispatched!")
    else:
        print(f"    ✅ Has been dispatched (provider_id: {order[5]})")
        print(f"    ✅ Celery should be checking this order!")

cursor.close()

print("\n" + "=" * 80)
