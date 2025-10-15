"""
Check domains table for tenant mapping
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

tenant_id = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'

with connection.cursor() as cursor:
    cursor.execute('SELECT * FROM domains WHERE "tenantId" = %s', [tenant_id])
    columns = [desc[0] for desc in cursor.description]
    print(f"Columns: {columns}\n")
    
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"Domain found:")
            for i, col in enumerate(columns):
                print(f"  {col}: {row[i]}")
    else:
        print(f"No domain found for tenant {tenant_id}")
        
    print("\n\nAll domains:")
    cursor.execute('SELECT "tenantId", domain FROM domains ORDER BY domain')
    for row in cursor.fetchall():
        print(f"  {row[1]:40} -> {row[0]}")
