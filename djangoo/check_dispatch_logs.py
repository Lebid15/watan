"""
Check if try_auto_dispatch was called for the ShamTech order
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

# ShamTech order
shamtech_order_id = "fe1db7e9-0bdf-4271-aa04-0b15346f058a"

print("\n" + "="*80)
print("📝 Checking Dispatch Logs")
print("="*80 + "\n")

print(f"Order: FE1DB7 (ShamTech)")
print(f"Full ID: {shamtech_order_id}\n")

with connection.cursor() as cursor:
    # First, check if table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'order_dispatch_log'
        )
    """)
    table_exists = cursor.fetchone()[0]
    
    if not table_exists:
        print("❌ Table 'order_dispatch_log' does not exist!")
        print("   → Dispatch logging is not enabled")
        print("   → Cannot check if try_auto_dispatch was called")
    else:
        # Get columns
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'order_dispatch_log'
            ORDER BY ordinal_position
        """)
        columns = [row[0] for row in cursor.fetchall()]
        print(f"✅ Table exists with columns: {', '.join(columns)}\n")
        
        # Get logs
        cursor.execute("""
            SELECT action, result, message
            FROM order_dispatch_log
            WHERE order_id = %s
            ORDER BY id DESC
            LIMIT 20
        """, [shamtech_order_id])
        
        logs = cursor.fetchall()
        
        if logs:
            print(f"📋 Found {len(logs)} log entries:\n")
            for log in logs:
                action, result, message = log
                print(f"   [{action}] {result}")
                if message:
                    print(f"      → {message}")
                print()
        else:
            print("❌ NO dispatch logs found!")
            print("\n   This means one of:")
            print("   1. try_auto_dispatch was NEVER called")
            print("   2. The order was skipped before logging")
            print("   3. Logging is disabled")

print("="*80)
