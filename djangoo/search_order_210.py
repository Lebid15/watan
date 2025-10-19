"""
Search for order with price 210
"""
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from apps.orders.models import ProductOrder
from apps.users.models import User, LegacyUser
from django.db.models import Q

print("=" * 80)
print("Searching for orders with price 210")
print("=" * 80)

# Search for Khalil's orders with price 210
orders = ProductOrder.objects.filter(
    Q(user_identifier__icontains='khalil') | Q(user_identifier__icontains='خليل')
).filter(
    Q(price=Decimal('210.00')) | Q(price=Decimal('210'))
).order_by('-created_at')

print(f"\nFound {orders.count()} orders with price 210:")

for order in orders:
    print(f"\n{'=' * 80}")
    print(f"Order ID: {order.id}")
    print(f"Short ID: {str(order.id)[:6].upper()}")
    print(f"Display ID: {getattr(order, 'display_id', 'N/A')}")
    print(f"Status: {order.status}")
    print(f"External Status: {order.external_status}")
    print(f"Price: {order.price}")
    print(f"Sell Price: {order.sell_price_amount}")
    print(f"User Identifier: {order.user_identifier}")
    print(f"Created: {order.created_at}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Package: {getattr(order.package, 'name', 'N/A') if hasattr(order, 'package') and order.package else 'N/A'}")

print("\n" + "=" * 80)
print("All recent orders for Khalil (last 10):")
print("=" * 80)

all_orders = ProductOrder.objects.filter(
    Q(user_identifier__icontains='khalil') | Q(user_identifier__icontains='خليل')
).order_by('-created_at')[:10]

for order in all_orders:
    print(f"\n  ID: {str(order.id)[:6].upper()} | Status: {order.status:10} | Price: {order.price:8} | Created: {order.created_at}")
    if hasattr(order, 'package') and order.package:
        print(f"       Package: {order.package.name}")

print("\n" + "=" * 80)
