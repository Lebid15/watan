import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()
cursor.execute('''
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'integrations' 
    ORDER BY ordinal_position
''')

print("Integrations table columns:")
for row in cursor.fetchall():
    print(f"  - {row[0]}")

cursor.close()
