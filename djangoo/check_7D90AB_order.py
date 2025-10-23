#!/usr/bin/env python
"""
Check the specific order 7D90AB to see what provider_id it has
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from apps.providers.models import Integration

print("\n" + "=" * 80)
print("CHECKING ORDER 7D90AB")
print("=" * 80)

with connection.cursor() as cursor:
    # Search by orderNo
    cursor.execute("""
        SELECT 
            id,
            "orderNo",
            "tenantId",
            "userId",
            "packageId",
            "providerId",
            status,
            "externalStatus",
            "createdAt",
            root_order_id
        FROM product_orders
        WHERE "orderNo"::text LIKE %s
        ORDER BY "createdAt" DESC
        LIMIT 5
    """, ['%7D90AB%'])
    
    rows = cursor.fetchall()
    
    if not rows:
        print("\n❌ No orders found matching '7D90AB'")
        print("\nLet me search for recent orders from halil user...")
        
        # Search for halil user
        cursor.execute("""
            SELECT DISTINCT u.id, u.username
            FROM users u
            WHERE u.username ILIKE %s
            LIMIT 5
        """, ['%halil%'])
        
        users = cursor.fetchall()
        if users:
            print(f"\nFound {len(users)} users matching 'halil':")
            for user_id, username in users:
                print(f"   - {username} (ID: {user_id})")
                
                # Get recent orders from this user
                cursor.execute("""
                    SELECT 
                        id,
                        "orderNo",
                        "tenantId",
                        "packageId",
                        "providerId",
                        status,
                        "externalStatus",
                        "createdAt"
                    FROM product_orders
                    WHERE "userId" = %s
                    ORDER BY "createdAt" DESC
                    LIMIT 3
                """, [user_id])
                
                user_orders = cursor.fetchall()
                print(f"     Recent orders: {len(user_orders)}")
                for order_row in user_orders:
                    order_id, order_no, tenant_id, package_id, provider_id, status, ext_status, created_at = order_row
                    order_no_str = f"{order_no:08X}" if order_no else "None"
                    print(f"\n     Order No: {order_no_str}")
                    print(f"        Order ID: {order_id}")
                    print(f"        Tenant ID: {tenant_id}")
                    print(f"        Status: {status} / {ext_status}")
                    print(f"        Provider ID: {provider_id}")
                    print(f"        Created: {created_at}")
                    
                    if provider_id:
                        try:
                            integration = Integration.objects.get(id=provider_id)
                            print(f"        Provider Name: {integration.name}")
                            print(f"        Provider Type: {integration.provider}")
                            
                            if str(provider_id) == '6d8790a9-9930-4543-80aa-b0b92aa16404':
                                print(f"        ⚠️  WARNING: This is alayaZnet (WRONG!)")
                            elif str(provider_id) == '71544f6c-705e-4e7f-bc3c-c24dc90428b7':
                                print(f"        ✅ This is diana (CORRECT)")
                        except Integration.DoesNotExist:
                            print(f"        ⚠️  Provider not found!")
    else:
        print(f"\nFound {len(rows)} orders matching '7D90AB':")
        
        for row in rows:
            order_id, order_no, tenant_id, user_id, package_id, provider_id, status, ext_status, created_at, root_order_id = row
            
            print(f"\nOrder No: {order_no:08X}")
            print(f"   Order ID: {order_id}")
            print(f"   Tenant ID: {tenant_id}")
            print(f"   User ID: {user_id}")
            print(f"   Package ID: {package_id}")
            print(f"   Status: {status} / {ext_status}")
            print(f"   Provider ID: {provider_id}")
            print(f"   Root Order: {root_order_id}")
            print(f"   Created: {created_at}")
            
            if provider_id:
                try:
                    integration = Integration.objects.get(id=provider_id)
                    print(f"\n   Provider Details:")
                    print(f"      Name: {integration.name}")
                    print(f"      Provider: {integration.provider}")
                    print(f"      Tenant ID: {integration.tenant_id}")
                    
                    if str(provider_id) == '6d8790a9-9930-4543-80aa-b0b92aa16404':
                        print(f"      ⚠️  WARNING: This is alayaZnet (WRONG!)")
                    elif str(provider_id) == '71544f6c-705e-4e7f-bc3c-c24dc90428b7':
                        print(f"      ✅ This is diana (CORRECT)")
                except Integration.DoesNotExist:
                    print(f"   ⚠️  Provider not found!")
            else:
                print(f"   ⚠️  No provider_id set")

print("\n" + "=" * 80 + "\n")
