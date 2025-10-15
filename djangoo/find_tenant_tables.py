"""
Find tenant-related tables
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname='public' 
        AND (tablename LIKE '%tenant%' OR tablename LIKE '%domain%')
        ORDER BY tablename
    """)
    print("Tables with 'tenant' or 'domain':")
    for row in cursor.fetchall():
        print(f"  {row[0]}")
    
    print("\n\nChecking dj_tenants structure:")
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name='dj_tenants' 
        ORDER BY ordinal_position
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:30} {row[1]}")
    
    print("\n\nSample dj_tenants data:")
    cursor.execute("SELECT * FROM dj_tenants")
    columns = [desc[0] for desc in cursor.description]
    for row in cursor.fetchall():
        print(f"\n  Row:")
        for i, col in enumerate(columns):
            print(f"    {col}: {row[i]}")
