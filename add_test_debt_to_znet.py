"""
إضافة قيمة تجريبية للدين لمزود ZNET
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
print("تحديث دين ZNET للاختبار")
print("=" * 60)

try:
    conn_string = f"host={DB_CONFIG['host']} port={DB_CONFIG['port']} dbname={DB_CONFIG['dbname']} user={DB_CONFIG['user']} password={DB_CONFIG['password']}"
    conn = psycopg.connect(conn_string)
    cursor = conn.cursor()
    
    print("\n✅ متصل بقاعدة البيانات")
    
    # البحث عن ZNET
    print("\n🔍 البحث عن مزود ZNET...")
    cursor.execute("""
        SELECT id, name, provider, balance 
        FROM integrations 
        WHERE LOWER(provider) = 'znet' OR LOWER(name) LIKE '%znet%'
        LIMIT 1;
    """)
    
    znet = cursor.fetchone()
    
    if znet:
        znet_id, name, provider, balance = znet
        print(f"\n✅ تم العثور على ZNET:")
        print(f"   ID: {znet_id}")
        print(f"   Name: {name}")
        print(f"   Provider: {provider}")
        print(f"   Balance: {balance}")
        
        # إضافة دين تجريبي (500 ليرة تركية)
        test_debt = 500.00
        print(f"\n💰 إضافة دين تجريبي: {test_debt} TRY")
        
        cursor.execute("""
            UPDATE integrations 
            SET debt = %s, "debtUpdatedAt" = NOW()
            WHERE id = %s;
        """, (test_debt, znet_id))
        
        conn.commit()
        
        # التحقق
        cursor.execute("""
            SELECT balance, debt, balance - debt as net_balance
            FROM integrations 
            WHERE id = %s;
        """, (znet_id,))
        
        result = cursor.fetchone()
        print("\n✅ تم التحديث بنجاح!")
        print(f"\n📊 النتيجة:")
        print(f"   الرصيد: {result[0]}")
        print(f"   الدين: {result[1]}")
        print(f"   المحصلة: {result[2]}")
        
    else:
        print("\n⚠️  لم يتم العثور على مزود ZNET")
        print("   يمكنك تحديث أي مزود آخر يدوياً")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ تم! الآن أعد تحميل الصفحة لترى التغيير")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
