"""
تطبيق Migration بسيط - إضافة حقول debt
يعمل بدون الحاجة لـ Django
"""
import psycopg
import sys

# إعدادات قاعدة البيانات
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'dbname': 'watan',
    'user': 'postgres',  # استخدم postgres للحصول على صلاحيات كاملة
    'password': input('Enter postgres password: '),  # سيطلب منك كلمة المرور
}

print("=" * 60)
print("تطبيق Migration: إضافة حقول debt")
print("=" * 60)

try:
    # الاتصال بقاعدة البيانات
    conn_string = f"host={DB_CONFIG['host']} port={DB_CONFIG['port']} dbname={DB_CONFIG['dbname']} user={DB_CONFIG['user']} password={DB_CONFIG['password']}"
    conn = psycopg.connect(conn_string)
    cursor = conn.cursor()
    
    print(f"\n✅ متصل بقاعدة البيانات: {DB_CONFIG['dbname']}")
    
    # تنفيذ SQL
    sql_commands = [
        ("Adding debt column", "ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;"),
        ("Adding debt_updated_at column", "ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;"),
        ("Adding comment for debt", "COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';"),
        ("Adding comment for debt_updated_at", "COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';"),
    ]
    
    for i, (desc, sql) in enumerate(sql_commands, 1):
        print(f"\n[{i}/{len(sql_commands)}] {desc}...")
        cursor.execute(sql)
        print(f"    ✅ نجح")
    
    conn.commit()
    
    # التحقق
    print("\n" + "=" * 60)
    print("التحقق من الأعمدة:")
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
            print(f"  • {col[0]:20} | {col[1]:15} | Nullable: {col[2]:3}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ Migration تم تطبيقه بنجاح!")
    print("=" * 60)
    print("\n🚀 الآن أعد تشغيل Backend:")
    print("   cd f:\\watan\\djangoo")
    print("   python manage.py runserver")
    
except psycopg.OperationalError as e:
    print(f"\n❌ خطأ في الاتصال: {e}")
    print("\n💡 تأكد من:")
    print("  1. أن PostgreSQL يعمل")
    print("  2. كلمة مرور postgres صحيحة")
    print("  3. قاعدة البيانات 'watan' موجودة")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
