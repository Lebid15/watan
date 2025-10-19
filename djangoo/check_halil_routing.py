import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

print("=" * 80)
print("🔍 Checking PackageRouting for Halil → Alsham")
print("=" * 80)

# Halil tenant
halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'

# Check if halil has any routing configured
cursor.execute('''
    SELECT 
        pr.id,
        pr."tenantId",
        pp.name as package_name,
        pr.mode,
        pr."providerType",
        pr."primaryProviderId"
    FROM package_routing pr
    JOIN product_packages pp ON pp.id = pr.package_id
    WHERE pr."tenantId" = %s
    ORDER BY pp.name
''', [halil_tenant_id])

routings = cursor.fetchall()

if routings:
    print(f"\n✅ Found {len(routings)} package routings in HALIL:")
    for r in routings:
        print(f"\n  Package: {r[2]}")
        print(f"    Mode: {r[3]}")
        print(f"    Provider Type: {r[4]}")
        print(f"    Primary Provider ID: {r[5] or 'NULL'}")
        
        if r[3] == 'manual':
            print(f"    ⚠️ MANUAL mode - orders won't be dispatched automatically!")
        elif r[3] == 'auto' and r[5]:
            print(f"    ✅ AUTO mode - orders will be dispatched to provider {r[5]}")
        else:
            print(f"    ❌ Problem: mode is {r[3]} but primaryProviderId is NULL!")
else:
    print(f"\n❌ NO routing configured in HALIL!")
    print(f"\n💡 This is the problem!")
    print(f"   Without routing:")
    print(f"     - Orders created in halil stay in halil")
    print(f"     - They are NOT automatically forwarded to alsham")
    print(f"     - Customer (khalil) creates order → it stays pending forever!")

# Check integrations between halil and alsham
print(f"\n" + "=" * 80)
print("🔍 Checking Integrations: Halil → Alsham")
print("=" * 80)

cursor.execute('''
    SELECT 
        id,
        name,
        type,
        "isActive"
    FROM integrations
    WHERE "tenantId" = %s
    AND "isActive" = true
''', [halil_tenant_id])

integrations = cursor.fetchall()

if integrations:
    print(f"\n✅ Found {len(integrations)} active integrations in HALIL:")
    for integ in integrations:
        print(f"\n  Integration: {integ[1]}")
        print(f"    Type: {integ[2]}")
        print(f"    Active: {integ[3]}")
        
        # Check if this integration is alsham
        if 'alsham' in integ[1].lower() or integ[2] == 'internal':
            print(f"    💡 This might be the connection to alsham!")
else:
    print(f"\n❌ NO active integrations in HALIL!")
    print(f"\n💡 This means:")
    print(f"   - Halil has no way to forward orders to alsham")
    print(f"   - You need to create an integration: halil → alsham")

cursor.close()

print(f"\n" + "=" * 80)
print("🎯 Solution:")
print("=" * 80)
print("""
For orders to flow from halil (customer) → alsham (admin):

Option 1: Auto Mode (Recommended)
  1. Create integration in halil pointing to alsham
  2. Set PackageRouting mode = 'auto'
  3. Set primaryProviderId = alsham integration ID
  4. When customer creates order → automatically forwarded to alsham!

Option 2: Manual Processing
  - Admin in HALIL manually forwards each order to alsham
  - But halil is a CUSTOMER site, not admin site!
  - This doesn't make sense!

Recommendation:
  - Use Option 1 (Auto mode)
  - Customer creates order → auto-forwarded to alsham → Celery tracks it!
""")
print("=" * 80)
