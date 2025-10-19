#!/usr/bin/env python
"""
Check Khalil's wallet issue - why wallet was debited instead of refunded
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
print("Checking Khalil's wallet issue")
print("=" * 80)

# Find Khalil's recent orders
orders_queryset = ProductOrder.objects.filter(
    Q(user_identifier__icontains='khalil') | Q(user_identifier__icontains='خليل')
).order_by('-created_at')

orders = list(orders_queryset[:5])

print(f"\nFound {len(orders)} recent orders for Khalil")
print("\nOrders:")
for order in orders:
    print(f"\n  Order ID: {order.id}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    print(f"  Price: {order.price}")
    print(f"  Sell Price: {order.sell_price_amount}")
    print(f"  Created: {order.created_at}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  Has parent order: {bool(order.external_order_id)}")

# Get the latest rejected order
rejected_order = orders_queryset.filter(status='rejected').first()
if rejected_order:
    print("\n" + "=" * 80)
    print(f"Latest rejected order: {rejected_order.id}")
    print("=" * 80)
    
    # Check wallet transactions for this order
    from apps.users.models import WalletTransaction
    transactions = WalletTransaction.objects.filter(
        order_id=str(rejected_order.id)
    ).order_by('timestamp')
    
    print(f"\nWallet transactions for this order ({len(transactions)}):")
    for txn in transactions:
        print(f"\n  Transaction ID: {txn.id}")
        print(f"  Type: {txn.transaction_type}")
        print(f"  Amount: {txn.amount}")
        print(f"  Balance Before: {txn.balance_before}")
        print(f"  Balance After: {txn.balance_after}")
        print(f"  Description: {txn.description}")
        print(f"  Timestamp: {txn.timestamp}")
        print(f"  Metadata: {txn.metadata}")
    
    # Check user balance
    try:
        legacy_user = LegacyUser.objects.get(
            id=rejected_order.user_id,
            tenant_id=rejected_order.tenant_id
        )
        print(f"\n  LegacyUser balance: {legacy_user.balance}")
    except LegacyUser.DoesNotExist:
        print("\n  LegacyUser not found")
    
    # Check if there's a child order
    if rejected_order.external_order_id:
        print(f"\n  This order is a child of: {rejected_order.external_order_id}")
        try:
            parent_order = ProductOrder.objects.get(id=rejected_order.external_order_id)
            print(f"  Parent order status: {parent_order.status}")
            print(f"  Parent order external_status: {parent_order.external_status}")
        except ProductOrder.DoesNotExist:
            print("  Parent order not found")
    
    # Check if this order has children
    child_orders = ProductOrder.objects.filter(external_order_id=rejected_order.id)
    if child_orders.exists():
        print(f"\n  This order has {child_orders.count()} child order(s):")
        for child in child_orders:
            print(f"    - Child ID: {child.id}")
            print(f"      Status: {child.status}")
            print(f"      External Status: {child.external_status}")

print("\n" + "=" * 80)
