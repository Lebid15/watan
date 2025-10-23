from django.db import connection

print("="*70)
print("CHECKING dj_users TABLE STRUCTURE")
print("="*70)

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'dj_users'
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    
    print("\nColumns in dj_users table:")
    for col in columns:
        print(f"  - {col[0]}: {col[1]}")
    
    # Check a sample user
    print("\n" + "="*70)
    print("SAMPLE USER FROM SHAMTECH")
    print("="*70)
    
    shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
    
    cursor.execute("""
        SELECT id, username, tenant_id, is_active
        FROM dj_users
        WHERE tenant_id = %s
        LIMIT 3
    """, [shamtech_tenant_id])
    
    users = cursor.fetchall()
    
    if users:
        for user in users:
            print(f"\nUser:")
            print(f"  ID: {user[0]} (type: {type(user[0])})")
            print(f"  Username: {user[1]}")
            print(f"  Tenant ID: {user[2]}")
            print(f"  Is Active: {user[3]}")
    else:
        print("\nNo users found in ShamTech!")

print("\n" + "="*70)
