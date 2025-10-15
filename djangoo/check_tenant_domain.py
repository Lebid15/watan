"""
Check tenant_domain mapping
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    print("tenant_domain table structure:")
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name='tenant_domain' 
        ORDER BY ordinal_position
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:30} {row[1]}")
    
    print("\n\nAll tenant_domain mappings:")
    cursor.execute("SELECT * FROM tenant_domain ORDER BY domain")
    columns = [desc[0] for desc in cursor.description]
    print(f"Columns: {columns}\n")
    
    for row in cursor.fetchall():
        print(f"Row: {row}")
    
    # Check if shamtech is there
    print("\n\nLooking for shamtech:")
    cursor.execute("SELECT * FROM tenant_domain WHERE domain LIKE '%shamtech%'")
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  Found: {row}")
            # Get tenant details
            cursor.execute("SELECT * FROM tenants WHERE id = %s", [row[columns.index('tenantId')]])
            tenant = cursor.fetchone()
            if tenant:
                print(f"  Tenant: {tenant}")
    else:
        print("  No shamtech domain found")
