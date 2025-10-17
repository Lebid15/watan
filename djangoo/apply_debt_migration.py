"""
تطبيق Migration لإضافة حقول debt و debt_updated_at
"""
import psycopg
import os

# قراءة إعدادات قاعدة البيانات من البيئة
DB_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
DB_PORT = os.environ.get('POSTGRES_PORT', '5432')
DB_NAME = os.environ.get('POSTGRES_DB', 'watan')
DB_USER = os.environ.get('POSTGRES_USER', 'watan')
DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'Asdf1212asdf.')

database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print("=" * 60)
print("تطبيق Migration: إضافة حقول debt و debt_updated_at")
print("=" * 60)
print(f"\nDatabase: {database_url.split('@')[1] if '@' in database_url else database_url}")

# الاتصال بقاعدة البيانات
try:
    conn = psycopg.connect(database_url)
    cursor = conn.cursor()
    
    # SQL للتطبيق
    sql_commands = [
        """
        ALTER TABLE integrations 
        ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;
        """,
        """
        ALTER TABLE integrations 
        ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
        """,
        """
        COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';
        """,
        """
        COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';
        """
    ]
    
    for i, sql in enumerate(sql_commands, 1):
        print(f"\n[{i}/{len(sql_commands)}] تنفيذ:", sql.strip()[:50] + "...")
        cursor.execute(sql)
        print(f"    ✅ نجح")
    
    conn.commit()
    
    # التحقق من النتيجة
    print("\n" + "=" * 60)
    print("التحقق من الأعمدة الجديدة:")
    print("=" * 60)
    
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'integrations' 
        AND column_name IN ('debt', 'debt_updated_at')
        ORDER BY column_name;
    """)
    
    columns = cursor.fetchall()
    if columns:
        print("\n✅ تم إضافة الأعمدة بنجاح:\n")
        for col in columns:
            print(f"  • {col[0]:20} | {col[1]:15} | Nullable: {col[2]:3} | Default: {col[3] or 'NULL'}")
    else:
        print("\n⚠️  لم يتم العثور على الأعمدة!")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ Migration تم تطبيقه بنجاح!")
    print("=" * 60)
    print("\nالآن يمكنك إعادة تشغيل Backend:")
    print("  cd f:\\watan\\djangoo")
    print("  python manage.py runserver")
    
except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
