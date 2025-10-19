#!/usr/bin/env python
"""
Check database schema for product_orders table
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

print("="*80)
print("CHECKING DATABASE SCHEMA")
print("="*80)

with connection.cursor() as cursor:
    # Get table schema
    cursor.execute("""
        SELECT 
            column_name,
            data_type,
            column_default,
            is_nullable
        FROM information_schema.columns
        WHERE table_name = 'product_orders'
        AND column_name = 'providerId'
    """)
    
    rows = cursor.fetchall()
    
    if rows:
        print(f"\nColumn: providerId")
        for row in rows:
            print(f"  Column Name: {row[0]}")
            print(f"  Data Type: {row[1]}")
            print(f"  Default: {row[2]}")
            print(f"  Nullable: {row[3]}")
    else:
        print(f"\nColumn providerId not found!")

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
