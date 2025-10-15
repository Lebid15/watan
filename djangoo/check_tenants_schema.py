"""
Check tenants table schema
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name='tenants' 
        ORDER BY ordinal_position
    """)
    print("Tenants table columns:")
    for row in cursor.fetchall():
        print(f"  {row[0]:30} {row[1]}")
    
    print("\n\nSample tenant data:")
    cursor.execute("SELECT * FROM tenants LIMIT 3")
    columns = [desc[0] for desc in cursor.description]
    print(f"Columns: {columns}")
    for row in cursor.fetchall():
        print(f"  {row}")
