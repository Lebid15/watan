"""
Diagnostic Script for Patch 5.x
Run this to check if the fixes are working correctly
Usage: python manage.py shell < diagnostic_patch_5x.py
"""

from django.db import connection
from decimal import Decimal
import json

print("\n" + "="*80)
print("🔍 Patch 5.x Diagnostic Report")
print("="*80 + "\n")

# 1. Check code for status field update
print("1️⃣ Checking if 'status' field is updated in dispatch code...")
try:
    with open('apps/orders/services.py', 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Find the UPDATE after dispatch
        if 'Step 13: Updating order in database' in content:
            idx = content.find('Step 13: Updating order in database')
            update_section = content[idx:idx+1500]
            
            # Check if status field is in UPDATE
            if '"status"' in update_section or 'status =' in update_section:
                if 'UPDATE product_orders' in update_section:
                    print("   ❌ PROBLEM: 'status' field found in UPDATE section!")
                    print("   This could cause premature completion")
            else:
                print("   ✅ PASS: 'status' field NOT in UPDATE statement")
        
        # Check terminal status mapping
        if "PATCH 5.x: Never set terminal status on dispatch" in content:
            print("   ✅ PASS: Patch 5.x comment found")
        else:
            print("   ⚠️  WARNING: Patch 5.x comment not found")
            
        # Check if terminal statuses are NOT set to terminal values on dispatch
        idx = content.find("elif status_raw in ['completed', 'done', 'success', 'failed', 'rejected', 'error']:")
        if idx > 0:
            next_lines = content[idx:idx+450]
            # Should keep it as 'processing' not 'completed' or 'failed'
            if ("external_status = 'processing'" in next_lines and 
                ("Keep it as 'processing'" in next_lines or "keep it as 'processing'" in next_lines)):
                print("   ✅ PASS: Terminal statuses mapped to 'processing'")
            else:
                print("   ❌ PROBLEM: Terminal statuses NOT properly mapped")
                print(f"   Debug: Found comment = {'Keep it as' in next_lines}")
        
        # Check for guardrail
        if "CRITICAL GUARDRAIL" in content or "Premature terminal status" in content:
            print("   ✅ PASS: Guardrail assertion added")
        else:
            print("   ⚠️  WARNING: Guardrail not found")
            
except Exception as e:
    print(f"   ❌ Error checking code: {e}")

# 2. Check recent orders in database
print("\n2️⃣ Checking recent orders...")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id::text,
            status,
            "externalStatus",
            "providerId",
            mode,
            "sentAt"::text
        FROM product_orders
        WHERE "sentAt" IS NOT NULL
        ORDER BY "sentAt" DESC
        LIMIT 5
    """)
    rows = cursor.fetchall()
    
    if rows:
        print(f"   Found {len(rows)} recent orders:\n")
        for row in rows:
            order_id, status, ext_status, provider_id, mode, sent_at = row
            print(f"   Order: {order_id[:13]}...")
            print(f"      status: {status:15} externalStatus: {ext_status}")
            print(f"      providerId: {provider_id if provider_id else 'NULL':20} mode: {mode or 'NULL'}")
            
            # Check for issues
            issues = []
            if status == 'approved' and ext_status in ('sent', 'processing', 'not_sent'):
                issues.append("⚠️  Premature approval detected!")
            
            if mode == 'MANUAL' and provider_id:
                issues.append("⚠️  Manual order has provider_id!")
            
            if not mode and not provider_id:
                issues.append("ℹ️  No mode and no provider")
            
            if issues:
                for issue in issues:
                    print(f"      {issue}")
            print()
    else:
        print("   No orders with sentAt found")

# 3. Check FX conversion
print("3️⃣ Checking FX conversion in recent orders...")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id::text,
            cost_price_usd,
            cost_try_at_order,
            fx_usd_try_at_order,
            "costCurrency"
        FROM product_orders
        WHERE cost_price_usd IS NOT NULL
        ORDER BY "createdAt" DESC
        LIMIT 3
    """)
    rows = cursor.fetchall()
    
    if rows:
        for row in rows:
            order_id, cost_usd, cost_try, fx_rate, currency = row
            print(f"   Order: {order_id[:13]}...")
            print(f"      cost_price_usd: {cost_usd}")
            print(f"      cost_try_at_order: {cost_try}")
            print(f"      fx_rate: {fx_rate}")
            print(f"      costCurrency: {currency}")
            
            # Check conversion
            if cost_try and fx_rate and cost_usd:
                expected_usd = float(cost_try) / float(fx_rate)
                actual_usd = float(cost_usd)
                diff = abs(expected_usd - actual_usd)
                
                if diff < 0.01:  # Allow small rounding diff
                    print(f"      ✅ FX conversion correct: {cost_try} / {fx_rate} = {cost_usd}")
                else:
                    print(f"      ❌ FX mismatch: expected {expected_usd:.4f}, got {actual_usd}")
            print()
    else:
        print("   No orders with cost_price_usd found")

# 4. Check feature flags
print("4️⃣ Checking feature flags...")
import os
flags = {
    'FF_USD_COST_ENFORCEMENT': os.getenv('FF_USD_COST_ENFORCEMENT'),
    'FF_CHAIN_STATUS_PROPAGATION': os.getenv('FF_CHAIN_STATUS_PROPAGATION'),
    'FF_AUTO_FALLBACK_ROUTING': os.getenv('FF_AUTO_FALLBACK_ROUTING'),
    'DJ_ZNET_SIMULATE': os.getenv('DJ_ZNET_SIMULATE'),
    'DJ_DEBUG_LOGS': os.getenv('DJ_DEBUG_LOGS'),
}

for flag, value in flags.items():
    status = "✅" if value in ('1', 'true', 'True', 'TRUE') else ("⚠️" if value in ('0', 'false', 'False', 'FALSE') else "❓")
    print(f"   {status} {flag}: {value}")

print("\n" + "="*80)
print("✅ Diagnostic Complete")
print("="*80)
print("\nRecommendations:")
print("1. Restart Django backend: python manage.py runserver")
print("2. Restart Celery worker: celery -A celery_app worker --pool=solo --loglevel=info")
print("3. Create a test order and monitor the logs")
print("4. Check order status immediately after dispatch (should be 'pending')")
print("5. Wait 30-60 seconds and check again (should be 'approved' or 'rejected')")
