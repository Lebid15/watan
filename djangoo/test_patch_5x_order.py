"""
Test Order Creation for Patch 5.x Verification
Creates a real order to test all 5 fixes

Usage: 
  python manage.py shell < test_patch_5x_order.py

Or in Django shell:
  exec(open('test_patch_5x_order.py').read())
"""

import os
os.environ['DJ_DEBUG_LOGS'] = '1'
os.environ['DJ_ZNET_SIMULATE'] = 'false'

from django.db import connection
from apps.orders.models import ProductOrder
from apps.integrations.models import Integration
from apps.packages.models import Package, PackageRouting
from decimal import Decimal
import time
import json

print("\n" + "="*80)
print("🧪 Patch 5.x Test Order Creation")
print("="*80 + "\n")

# Find tenants
with connection.cursor() as cursor:
    # Get Khalil tenant
    cursor.execute("SELECT id::text, name FROM tenants WHERE name ILIKE '%khalil%' LIMIT 1")
    khalil = cursor.fetchone()
    
    # Get Al-Sham tenant
    cursor.execute("SELECT id::text, name FROM tenants WHERE name ILIKE '%sham%' AND name NOT ILIKE '%shamtech%' LIMIT 1")
    alsham = cursor.fetchone()
    
    # Get ShamTech tenant
    cursor.execute("SELECT id::text, name FROM tenants WHERE name ILIKE '%shamtech%' LIMIT 1")
    shamtech = cursor.fetchone()

if not (khalil and alsham and shamtech):
    print("❌ Cannot find required tenants!")
    print(f"   Khalil: {khalil}")
    print(f"   Al-Sham: {alsham}")
    print(f"   ShamTech: {shamtech}")
    exit(1)

print(f"✅ Found tenants:")
print(f"   Khalil: {khalil[0][:13]}... ({khalil[1]})")
print(f"   Al-Sham: {alsham[0][:13]}... ({alsham[1]})")
print(f"   ShamTech: {shamtech[0][:13]}... ({shamtech[1]})")

# Find a package with routing
print("\n🔍 Finding package with routing...")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT DISTINCT p.id::text, p.name
        FROM packages p
        INNER JOIN package_routing pr ON pr.package_id = p.id
        WHERE p."tenantId" = %s
        LIMIT 1
    """, [shamtech[0]])
    package_info = cursor.fetchone()

if not package_info:
    print("❌ No package with routing found for ShamTech!")
    exit(1)

package_id, package_name = package_info
print(f"✅ Found package: {package_id[:13]}... ({package_name})")

# Create test order
print("\n📝 Creating test order...")
print("   Note: This will actually create an order in the database!")
print("   You should have:")
print("   - DJ_DEBUG_LOGS=1")
print("   - DJ_ZNET_SIMULATE=false")
print("   - Celery worker running")

response = input("\nProceed? (yes/no): ")
if response.lower() != 'yes':
    print("Aborted.")
    exit(0)

# Create order via SQL for precise control
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
        RETURNING id::text, status, "externalStatus", mode
    """, [shamtech[0], shamtech[0], package_id])
    
    order_data = cursor.fetchone()
    order_id = order_data[0]

print(f"\n✅ Order created: {order_id}")
print(f"   Initial status: {order_data[1]}")
print(f"   Initial externalStatus: {order_data[2]}")
print(f"   Mode: {order_data[3]}")

# Now dispatch it
print("\n🚀 Dispatching order...")
print("   Watching for:")
print("   1. Status should stay 'pending' after dispatch")
print("   2. externalStatus should be 'sent' or 'processing'")
print("   3. providerId should be set (not NULL)")

# Check BEFORE dispatch
print("\n📊 BEFORE DISPATCH:")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id::text,
            status,
            "externalStatus",
            "providerId",
            "externalOrderId",
            mode,
            "sentAt"::text,
            "lastMessage"
        FROM product_orders
        WHERE id = %s
    """, [order_id])
    
    row = cursor.fetchone()
    print(f"""
    Order ID:         {row[0]}
    status:           {row[1]}
    externalStatus:   {row[2]}
    providerId:       {row[3] or 'NULL'}
    externalOrderId:  {row[4] or 'NULL'}
    mode:             {row[5]}
    sentAt:           {row[6] or 'NULL'}
    lastMessage:      {row[7] or 'NULL'}
    """)

# Import dispatch service
from apps.orders.services import try_auto_dispatch_async

print("\n⏳ Calling try_auto_dispatch_async()...")
print("   (Check terminal for logs with DJ_DEBUG_LOGS=1)")

try:
    # This should trigger the dispatch
    result = try_auto_dispatch_async(order_id)
    print(f"\n✅ Dispatch completed")
except Exception as e:
    print(f"\n❌ Dispatch failed: {e}")
    import traceback
    traceback.print_exc()

# Wait a moment for DB commit
time.sleep(2)

# Check IMMEDIATELY AFTER dispatch (t≈0-2s)
print("\n📊 IMMEDIATELY AFTER DISPATCH (t≈2s):")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id::text,
            status,
            "externalStatus",
            "providerId",
            "externalOrderId",
            mode,
            "sentAt"::text,
            "lastMessage",
            cost_price_usd,
            cost_try_at_order,
            fx_usd_try_at_order
        FROM product_orders
        WHERE id = %s
    """, [order_id])
    
    row = cursor.fetchone()
    print(f"""
    Order ID:            {row[0]}
    status:              {row[1]}
    externalStatus:      {row[2]}
    providerId:          {row[3] or 'NULL'}
    externalOrderId:     {row[4] or 'NULL'}
    mode:                {row[5]}
    sentAt:              {row[6] or 'NULL'}
    lastMessage:         {row[7] or 'NULL'}
    cost_price_usd:      {row[8] or 'NULL'}
    cost_try_at_order:   {row[9] or 'NULL'}
    fx_usd_try_at_order: {row[10] or 'NULL'}
    """)
    
    # Validate
    issues = []
    
    # Issue #1: Premature completion
    if row[1] in ('approved', 'rejected', 'completed', 'failed'):
        issues.append("❌ ISSUE #1: Status is TERMINAL immediately after dispatch!")
    else:
        print("   ✅ Issue #1: Status is NOT terminal (correct)")
    
    # Issue #2: FX conversion
    if row[8] and row[9] and row[10]:
        expected_usd = float(row[9]) / float(row[10])
        actual_usd = float(row[8])
        if abs(expected_usd - actual_usd) < 0.01:
            print(f"   ✅ Issue #2: FX conversion correct ({row[9]} / {row[10]} = {row[8]})")
        else:
            issues.append(f"❌ ISSUE #2: FX mismatch! Expected {expected_usd:.4f}, got {actual_usd}")
    
    # Issue #3: Manual with provider
    if row[5] == 'MANUAL' and row[3]:
        issues.append("❌ ISSUE #3: Manual order has providerId!")
    
    if issues:
        print("\n⚠️  ISSUES DETECTED:")
        for issue in issues:
            print(f"   {issue}")
    else:
        print("\n   ✅ All checks passed!")

print("\n⏳ Now waiting 30 seconds for Celery to poll status...")
print("   (Make sure Celery worker is running!)")

for i in range(30, 0, -5):
    print(f"   {i} seconds remaining...")
    time.sleep(5)

# Check AFTER Celery poll (t≈30-60s)
print("\n📊 AFTER CELERY POLL (t≈30s):")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id::text,
            status,
            "externalStatus",
            "providerId",
            "externalOrderId",
            "lastMessage",
            "polledAt"::text
        FROM product_orders
        WHERE id = %s
    """, [order_id])
    
    row = cursor.fetchone()
    print(f"""
    Order ID:         {row[0]}
    status:           {row[1]}
    externalStatus:   {row[2]}
    providerId:       {row[3] or 'NULL'}
    externalOrderId:  {row[4] or 'NULL'}
    lastMessage:      {row[5] or 'NULL'}
    polledAt:         {row[6] or 'NULL'}
    """)
    
    if row[1] in ('approved', 'rejected', 'completed', 'failed'):
        print("   ✅ Status is now terminal (expected after Celery poll)")
    else:
        print("   ⚠️  Status is still NOT terminal (Celery may not have polled yet)")

print("\n" + "="*80)
print("✅ Test Complete")
print("="*80)
print(f"\nOrder ID for reference: {order_id}")
print("\nNext steps:")
print("1. Review the logs above")
print("2. Compare 'IMMEDIATELY AFTER' vs 'AFTER CELERY' sections")
print("3. Verify status stayed 'pending' until Celery polled")
print("4. Check Celery logs for check_order_status task execution")
