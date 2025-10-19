"""
Search for order 950C04 in all tenants
"""
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from decimal import Decimal

print("=" * 80)
print("Searching for order 950C04 in ALL tenants")
print("=" * 80)

# Search by UUID prefix
orders = ProductOrder.objects.filter(id__startswith='950c04')

if orders.exists():
    print(f"\nFound {orders.count()} order(s) with UUID starting with 950c04:")
    for order in orders:
        print(f"\n{'=' * 80}")
        print(f"Order ID: {order.id}")
        print(f"Status: {order.status}")
        print(f"Price: {order.price}")
        print(f"User: {order.user_identifier}")
        print(f"Tenant ID: {order.tenant_id}")
        print(f"Created: {order.created_at}")
else:
    print("\nNo orders found with UUID starting with 950c04")
    
    # Try searching for recent orders with price 210
    print("\n" + "=" * 80)
    print("Searching for ALL orders with price 210 (any tenant, last 20)")
    print("=" * 80)
    
    orders_210 = ProductOrder.objects.filter(
        price=Decimal('210.00')
    ).order_by('-created_at')[:20]
    
    if orders_210.exists():
        for order in orders_210:
            print(f"\n  ID: {str(order.id)[:6].upper()}")
            print(f"  Status: {order.status}")
            print(f"  User: {order.user_identifier}")
            print(f"  Price: {order.price}")
            print(f"  Created: {order.created_at}")
            print(f"  Package: {getattr(order.package, 'name', 'N/A') if hasattr(order, 'package') and order.package else 'N/A'}")
    else:
        print("\nNo orders found with price 210")

print("\n" + "=" * 80)
