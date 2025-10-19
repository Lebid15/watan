import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
import uuid

print("=" * 80)
print("🔧 Setup Auto-Routing: Halil → Alsham")
print("=" * 80)

# Tenant IDs
halil_tenant_id = 'ed69e1f7-e69f-47c4-9e61-86e57990ffcc'
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

cursor = connection.cursor()

# Step 1: Find or create integration from halil to alsham
print("\n📋 Step 1: Check integration halil → alsham")

cursor.execute('''
    SELECT id, name, provider
    FROM integrations
    WHERE "tenantId" = %s
    AND provider = 'alsham'
''', [halil_tenant_id])

integration = cursor.fetchone()

if integration:
    integration_id = integration[0]
    print(f"  ✅ Found existing integration: {integration[1]} (ID: {integration_id})")
else:
    print(f"  ❌ No integration found from halil to alsham!")
    print(f"  💡 Creating integration...")
    
    integration_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO integrations (
            id, "tenantId", name, provider, enabled, "createdAt"
        ) VALUES (
            %s, %s, %s, %s, %s, NOW()
        )
    ''', [
        integration_id,
        halil_tenant_id,
        'Alsham Integration',
        'alsham',
        True
    ])
    print(f"  ✅ Created integration: {integration_id}")

# Step 2: Find packages in halil
print("\n📦 Step 2: Find packages in halil")

cursor.execute('''
    SELECT id, name
    FROM product_packages
    WHERE "tenantId" = %s
    ORDER BY name
''', [halil_tenant_id])

packages = cursor.fetchall()

if not packages:
    print(f"  ❌ No packages found in halil!")
    print(f"  💡 You need to create packages in halil first!")
else:
    print(f"  ✅ Found {len(packages)} packages in halil")
    
    # Step 3: Create/Update PackageRouting for each package
    print(f"\n🔧 Step 3: Setup auto-routing for each package")
    
    for pkg in packages:
        pkg_id = pkg[0]
        pkg_name = pkg[1]
        
        # Check if routing exists
        cursor.execute('''
            SELECT id, mode, "primaryProviderId"
            FROM package_routing
            WHERE "tenantId" = %s AND package_id = %s
        ''', [halil_tenant_id, pkg_id])
        
        routing = cursor.fetchone()
        
        if routing:
            # Update existing routing
            if routing[1] != 'auto' or routing[2] != integration_id:
                cursor.execute('''
                    UPDATE package_routing
                    SET mode = 'auto',
                        "providerType" = 'internal',
                        "primaryProviderId" = %s
                    WHERE id = %s
                ''', [integration_id, routing[0]])
                print(f"  ✅ Updated: {pkg_name} → AUTO mode → alsham")
            else:
                print(f"  ✅ Already configured: {pkg_name} → AUTO mode → alsham")
        else:
            # Create new routing
            routing_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO package_routing (
                    id, "tenantId", package_id, mode, 
                    "providerType", "primaryProviderId"
                ) VALUES (
                    %s, %s, %s, 'auto', 'internal', %s
                )
            ''', [routing_id, halil_tenant_id, pkg_id, integration_id])
            print(f"  ✅ Created: {pkg_name} → AUTO mode → alsham")

connection.commit()
cursor.close()

print("\n" + "=" * 80)
print("✅ Setup Complete!")
print("=" * 80)
print("""
Now when a customer creates an order in halil:
  1. Order is created in halil
  2. System checks PackageRouting (mode = auto)
  3. Automatically forwards order to alsham
  4. Alsham receives the order (with root_order_id)
  5. Celery tracks the order status!
  6. When alsham order completes → halil order completes!

Test it:
  1. Go to http://halil.localhost:3000 (as customer khalil)
  2. Create a new order (pubg global 325)
  3. Order should appear in alsham automatically!
  4. Watch Celery logs - it will track it!
""")
print("=" * 80)
