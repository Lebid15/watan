"""
إعادة تسمية العمود ليطابق نمط التسمية في الجدول
"""
import psycopg

DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'dbname': 'watan',
    'user': 'postgres',
    'password': 'Asdf1212asdf.',
}

print("=" * 60)
print("إعادة تسمية debt_updated_at إلى debtUpdatedAt")
print("=" * 60)

try:
    conn_string = f"host={DB_CONFIG['host']} port={DB_CONFIG['port']} dbname={DB_CONFIG['dbname']} user={DB_CONFIG['user']} password={DB_CONFIG['password']}"
    conn = psycopg.connect(conn_string)
    cursor = conn.cursor()
    
    print("\n✅ متصل بقاعدة البيانات")
    
    # إعادة تسمية العمود
    print("\nإعادة تسمية العمود...")
    cursor.execute("""
        ALTER TABLE integrations 
        RENAME COLUMN debt_updated_at TO "debtUpdatedAt";
    """)
    
    conn.commit()
    
    print("✅ تم إعادة التسمية بنجاح!")
    
    # التحقق
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'integrations' 
        AND column_name IN ('debt', 'debtUpdatedAt')
        ORDER BY column_name;
    """)
    
    columns = cursor.fetchall()
    print("\n✅ الأعمدة الموجودة:")
    for col in columns:
        print(f"  • {col[0]}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ تم بنجاح! أعد تشغيل Backend")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
