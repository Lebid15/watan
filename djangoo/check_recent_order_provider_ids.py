#!/usr/bin/env python
"""
Check recent orders to see what provider_id they have
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration
from django.db import connection

print("\n" + "=" * 80)
print("CHECKING RECENT ORDERS - PROVIDER IDs")
print("=" * 80)

# Get recent orders from ShamTech tenant (where diana integration exists)
shamtech_tenant_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            id,
            "userId",
            "createdAt",
            "providerId",
            status,
            "externalStatus"
        FROM product_orders
        WHERE "tenantId" = %s
        ORDER BY "createdAt" DESC
        LIMIT 10
    """, [shamtech_tenant_id])
    
    rows = cursor.fetchall()
    
    print(f"\nFound {len(rows)} recent orders from ShamTech tenant:")
    print()
    
    for row in rows:
        order_id, user_id, created_at, provider_id, status, ext_status = row
        
        print(f"Order ID: {order_id}")
        print(f"   User ID: {user_id}")
        print(f"   Created: {created_at}")
        print(f"   Status: {status} / {ext_status}")
        print(f"   Provider ID: {provider_id}")
        
        if provider_id:
            try:
                integration = Integration.objects.get(id=provider_id)
                print(f"   Provider Name: {integration.name}")
                print(f"   Provider Type: {integration.provider}")
                
                if str(provider_id) == '6d8790a9-9930-4543-80aa-b0b92aa16404':
                    print(f"   ⚠️  WARNING: This is alayaZnet (WRONG!)")
                elif str(provider_id) == '71544f6c-705e-4e7f-bc3c-c24dc90428b7':
                    print(f"   ✅ This is diana (CORRECT)")
            except Integration.DoesNotExist:
                print(f"   ⚠️  Provider not found!")
        else:
            print(f"   ⚠️  No provider_id set")
        
        print()

print("=" * 80 + "\n")
