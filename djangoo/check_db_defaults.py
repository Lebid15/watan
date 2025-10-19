"""
Check database default for mode column
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'product_orders'
        AND column_name IN ('mode', 'providerId')
        ORDER BY column_name
    """)
    
    results = cursor.fetchall()
    print("\nColumns in product_orders table:")
    print("="*80)
    for row in results:
        col_name, col_default, is_nullable = row
        print(f"{col_name:20} | Default: {col_default or 'NULL':30} | Nullable: {is_nullable}")
