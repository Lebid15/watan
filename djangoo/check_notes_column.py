import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Check notes column constraint
    cursor.execute("""
        SELECT column_name, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'product_orders' 
        AND column_name = 'notes'
    """)
    result = cursor.fetchone()
    print(f"Column: {result[0]}")
    print(f"Is Nullable: {result[1]}")
    print(f"Default: {result[2]}")
