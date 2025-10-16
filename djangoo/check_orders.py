# Check last order with externalOrderId relationship
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='watan',
    user='postgres',
    password='Asdf1212asdf.'
)

cursor = conn.cursor()

# Get last order and its related order via externalOrderId
cursor.execute("""
    SELECT 
        o1.id,
        o1.status,
        o1."manualNote",
        o1."providerMessage",
        o1."externalOrderId",
        o1."createdAt",
        o2.id as related_id,
        o2.status as related_status,
        o2."manualNote" as related_manual_note,
        o2."providerMessage" as related_provider_message
    FROM product_orders o1
    LEFT JOIN product_orders o2 ON o1."externalOrderId"::uuid = o2.id
    ORDER BY o1."createdAt" DESC
    LIMIT 3
""")

results = cursor.fetchall()

print("\n=== آخر 3 طلبات مع الطلبات المرتبطة ===\n")
for row in results:
    print(f"الطلب الأصلي:")
    print(f"  ID: {row[0]}")
    print(f"  Status: {row[1]}")
    print(f"  Manual Note: {row[2] or 'NULL'}")
    print(f"  Provider Message: {row[3] or 'NULL'}")
    print(f"  External Order ID: {row[4] or 'NULL'}")
    print(f"  Created At: {row[5]}")
    
    if row[6]:
        print(f"\n  الطلب المرتبط:")
        print(f"    ID: {row[6]}")
        print(f"    Status: {row[7]}")
        print(f"    Manual Note: {row[8] or 'NULL'}")
        print(f"    Provider Message: {row[9] or 'NULL'}")
    print("---\n")

cursor.close()
conn.close()
