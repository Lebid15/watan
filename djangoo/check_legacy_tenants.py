"""
Check legacy tenants table
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT id, host, name FROM tenants WHERE id = %s", ['fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'])
    row = cursor.fetchone()
    if row:
        print(f"Found tenant:")
        print(f"ID: {row[0]}")
        print(f"Host: {row[1]}")
        print(f"Name: {row[2]}")
    else:
        print("Tenant not found")
        
    print("\n\nAll tenants:")
    cursor.execute("SELECT id, host, name FROM tenants ORDER BY host")
    for row in cursor.fetchall():
        print(f"{row[1]:30} {row[2]:20} {row[0]}")
