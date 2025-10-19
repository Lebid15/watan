"""
Simple Test Order Creation - Patch 5.x Verification
"""

import os
os.environ['DJ_DEBUG_LOGS'] = '1'
os.environ['DJ_ZNET_SIMULATE'] = 'false'

from django.db import connection
import time

print("\n" + "="*80)
print("🧪 Patch 5.x - Simple Test Order")
print("="*80 + "\n")

# Find ShamTech tenant
with connection.cursor() as cursor:
    cursor.execute("SELECT id::text, name FROM tenants WHERE name ILIKE '%shamtech%' LIMIT 1")
    shamtech = cursor.fetchone()

if not shamtech:
    print("❌ Cannot find ShamTech tenant!")
    exit(1)

shamtech_id = shamtech[0]
print(f"✅ Found ShamTech: {shamtech_id[:13]}... ({shamtech[1]})")

# Find a package with routing
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT DISTINCT p.id::text, p.name
        FROM packages p
        INNER JOIN package_routing pr ON pr.package_id = p.id
        WHERE p."tenantId" = %s
        LIMIT 1
    """, [shamtech_id])
    package_info = cursor.fetchone()

if not package_info:
    print("❌ No package with routing found!")
    exit(1)

package_id = package_info[0]
print(f"✅ Found package: {package_id[:13]}... ({package_info[1]})")

# Create order
print("\n📝 Creating test order...")

response = input("Proceed with order creation? (yes/no): ")
if response.lower() != 'yes':
    print("Aborted.")
    exit(0)

with connection.cursor() as cursor:
    cursor.execute("""
        INSERT INTO product_orders (
            id,
            "tenantId",
            "userId",
            "packageId",
            "productValue",
            quantity,
            "costPrice",
            status,
            "externalStatus",
            mode,
            "createdAt",
            "updatedAt"
        ) VALUES (
            gen_random_uuid(),
            %s,
            (SELECT id FROM users WHERE "tenantId"=%s LIMIT 1),
            %s,
            '12345',
            1,
            0,
            'pending',
            'not_sent',
            'AUTO',
            NOW(),
            NOW()
        )
        RETURNING id::text
    """, [shamtech_id, shamtech_id, package_id])
    
    order_id = cursor.fetchone()[0]

print(f"\n✅ Order created: {order_id}")

# Check BEFORE dispatch
print("\n📊 BEFORE DISPATCH:")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT status, "externalStatus", "providerId", mode
        FROM product_orders WHERE id = %s
    """, [order_id])
    row = cursor.fetchone()
    print(f"  status:         {row[0]}")
    print(f"  externalStatus: {row[1]}")
    print(f"  providerId:     {row[2] or 'NULL'}")
    print(f"  mode:           {row[3]}")

# Dispatch
print("\n🚀 Dispatching order...")
from apps.orders.services import try_auto_dispatch_async

try:
    try_auto_dispatch_async(order_id)
    print("✅ Dispatch completed")
except Exception as e:
    print(f"❌ Dispatch failed: {e}")
    import traceback
    traceback.print_exc()

time.sleep(2)

# Check IMMEDIATELY AFTER dispatch
print("\n📊 IMMEDIATELY AFTER DISPATCH (t≈2s):")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            status, 
            "externalStatus", 
            "providerId", 
            "externalOrderId",
            cost_price_usd,
            cost_try_at_order,
            fx_usd_try_at_order
        FROM product_orders WHERE id = %s
    """, [order_id])
    row = cursor.fetchone()
    
    print(f"  status:              {row[0]}")
    print(f"  externalStatus:      {row[1]}")
    print(f"  providerId:          {row[2] or 'NULL'}")
    print(f"  externalOrderId:     {row[3] or 'NULL'}")
    print(f"  cost_price_usd:      {row[4] or 'NULL'}")
    print(f"  cost_try_at_order:   {row[5] or 'NULL'}")
    print(f"  fx_usd_try_at_order: {row[6] or 'NULL'}")
    
    # Validate Issue #1
    if row[0] in ('approved', 'rejected', 'completed', 'failed'):
        print("\n  ❌ ISSUE #1: Status is TERMINAL immediately after dispatch!")
    else:
        print("\n  ✅ Issue #1: Status is NOT terminal (correct)")
    
    # Validate Issue #2
    if row[4] and row[5] and row[6]:
        expected_usd = float(row[5]) / float(row[6])
        actual_usd = float(row[4])
        if abs(expected_usd - actual_usd) < 0.01:
            print(f"  ✅ Issue #2: FX correct ({row[5]} / {row[6]} = {row[4]})")
        else:
            print(f"  ❌ ISSUE #2: FX mismatch! Expected {expected_usd:.4f}, got {actual_usd}")

print("\n⏳ Waiting 30 seconds for Celery to poll...")
for i in range(30, 0, -5):
    print(f"  {i} seconds...")
    time.sleep(5)

# Check AFTER Celery
print("\n📊 AFTER CELERY POLL (t≈30s):")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT status, "externalStatus", "polledAt"::text
        FROM product_orders WHERE id = %s
    """, [order_id])
    row = cursor.fetchone()
    
    print(f"  status:         {row[0]}")
    print(f"  externalStatus: {row[1]}")
    print(f"  polledAt:       {row[2] or 'NULL'}")
    
    if row[0] in ('approved', 'rejected'):
        print("\n  ✅ Status is now terminal (expected after Celery)")
    else:
        print("\n  ⚠️  Status still NOT terminal (Celery may not have polled)")

print("\n" + "="*80)
print(f"✅ Test Complete - Order ID: {order_id}")
print("="*80)
