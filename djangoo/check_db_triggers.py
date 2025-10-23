#!/usr/bin/env python
"""
Check database triggers
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

print("="*80)
print("CHECKING DATABASE TRIGGERS")
print("="*80)

with connection.cursor() as cursor:
    # Get all triggers on product_orders table
    cursor.execute("""
        SELECT 
            trigger_name,
            event_manipulation,
            action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'product_orders'
    """)
    
    rows = cursor.fetchall()
    
    if rows:
        print(f"\nFound {len(rows)} triggers on product_orders table:")
        for row in rows:
            print(f"\n  Trigger: {row[0]}")
            print(f"  Event: {row[1]}")
            print(f"  Action: {row[2][:200]}...")
    else:
        print(f"\nNo triggers found on product_orders table")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)



