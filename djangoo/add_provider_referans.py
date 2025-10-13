#!/usr/bin/env python
"""
Script to add provider_referans field to product_orders table
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection

def check_field_exists():
    """Check if provider_referans field exists"""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'product_orders' 
            AND column_name = 'provider_referans'
        """)
        result = cursor.fetchone()
        return result is not None

def add_field():
    """Add provider_referans field and index"""
    with connection.cursor() as cursor:
        try:
            # Add column
            cursor.execute("""
                ALTER TABLE product_orders 
                ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255)
            """)
            print("✅ Added provider_referans column")
            
            # Add index
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_orders_provider_referans 
                ON product_orders(provider_referans)
            """)
            print("✅ Created index on provider_referans")
            
            return True
        except Exception as e:
            print(f"❌ Error: {e}")
            return False

if __name__ == "__main__":
    print("🔍 Checking if provider_referans field exists...")
    
    if check_field_exists():
        print("✅ Field already exists! Nothing to do.")
    else:
        print("❌ Field does not exist. Adding it...")
        if add_field():
            print("🎉 Migration completed successfully!")
        else:
            print("⚠️ Migration failed. Please check database permissions.")
            print("   You may need to run this SQL manually as database owner:")
            print("   ALTER TABLE product_orders ADD COLUMN provider_referans VARCHAR(255);")
            print("   CREATE INDEX idx_orders_provider_referans ON product_orders(provider_referans);")
