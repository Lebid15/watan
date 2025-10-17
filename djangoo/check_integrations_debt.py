"""
فحص وجود حقل debt في جدول integrations
"""
import os
import sys
import django

# إعداد Django
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from django.db import connection

print("=" * 60)
print("فحص أعمدة جدول integrations")
print("=" * 60)

with connection.cursor() as cursor:
    # جلب جميع الأعمدة من جدول integrations
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'integrations'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    
    print(f"\nإجمالي الأعمدة: {len(columns)}\n")
    
    debt_found = False
    
    for col in columns:
        col_name, data_type, nullable, default = col
        print(f"  {col_name:25} | {data_type:15} | Nullable: {nullable:3} | Default: {default or 'NULL'}")
        
        if col_name.lower() == 'debt':
            debt_found = True
    
    print("\n" + "=" * 60)
    if debt_found:
        print("✅ حقل 'debt' موجود في جدول integrations")
    else:
        print("❌ حقل 'debt' غير موجود في جدول integrations")
    print("=" * 60)
    
    # فحص بيانات ZNET
    print("\nفحص بيانات مزود ZNET:")
    cursor.execute("""
        SELECT id, name, provider, balance, balance_updated_at
        FROM integrations
        WHERE provider = 'znet' OR LOWER(name) LIKE '%znet%'
        LIMIT 5;
    """)
    
    znet_data = cursor.fetchall()
    if znet_data:
        print(f"\nتم العثور على {len(znet_data)} سجل لـ ZNET:\n")
        for row in znet_data:
            print(f"  ID: {row[0]}")
            print(f"  Name: {row[1]}")
            print(f"  Provider: {row[2]}")
            print(f"  Balance: {row[3]}")
            print(f"  Updated: {row[4]}")
            print("-" * 40)
    else:
        print("  لم يتم العثور على سجلات ZNET")
