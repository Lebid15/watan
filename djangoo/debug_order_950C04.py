"""
Debug order 950C04 - Khalil's rejected order
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
from apps.users.models import User, LegacyUser, WalletTransaction
from django.db.models import Q

print("=" * 80)
print("Debugging Order 950C04")
print("=" * 80)

# Find order by display ID or UUID prefix
order = None
try:
    # Try by UUID prefix
    orders = ProductOrder.objects.filter(id__startswith='950c04')
    if orders.exists():
        order = orders.first()
except:
    pass

if not order:
    # Try by display_id
    try:
        order = ProductOrder.objects.get(display_id='950C04')
    except:
        pass

if not order:
    print("Order not found!")
    print("\nSearching for recent rejected orders for Khalil...")
    orders = ProductOrder.objects.filter(
        Q(user_identifier__icontains='khalil') | Q(user_identifier__icontains='خليل'),
        status='rejected'
    ).order_by('-created_at')[:5]
    
    print(f"\nFound {orders.count()} rejected orders:")
    for o in orders:
        print(f"\n  Order ID: {o.id}")
        print(f"  Display ID: {getattr(o, 'display_id', 'N/A')}")
        print(f"  Status: {o.status}")
        print(f"  Price: {o.price}")
        print(f"  Created: {o.created_at}")
    sys.exit(1)

print(f"\nOrder ID: {order.id}")
print(f"Display ID: {getattr(order, 'display_id', 'N/A')}")
print(f"Status: {order.status}")
print(f"External Status: {order.external_status}")
print(f"Price: {order.price}")
print(f"Sell Price: {order.sell_price_amount}")
print(f"User ID: {order.user_id}")
print(f"User Identifier: {order.user_identifier}")
print(f"Tenant ID: {order.tenant_id}")
print(f"Created: {order.created_at}")
print(f"External Order ID: {order.external_order_id}")

# Check if this is a chain order
if order.external_order_id:
    print(f"\n{'=' * 80}")
    print("This order is part of a chain (parent order exists)")
    print(f"{'=' * 80}")
    try:
        parent = ProductOrder.objects.get(id=order.external_order_id)
        print(f"\nParent Order ID: {parent.id}")
        print(f"Parent Status: {parent.status}")
        print(f"Parent User: {parent.user_identifier}")
        print(f"Parent Price: {parent.price}")
        
        # Check if parent has a parent
        if parent.external_order_id:
            try:
                grandparent = ProductOrder.objects.get(id=parent.external_order_id)
                print(f"\nGrandparent Order ID: {grandparent.id}")
                print(f"Grandparent Status: {grandparent.status}")
                print(f"Grandparent User: {grandparent.user_identifier}")
                print(f"Grandparent Price: {grandparent.price}")
            except ProductOrder.DoesNotExist:
                print("\nGrandparent order not found")
    except ProductOrder.DoesNotExist:
        print("\nParent order not found!")

# Check for child orders
children = ProductOrder.objects.filter(external_order_id=order.id)
if children.exists():
    print(f"\n{'=' * 80}")
    print(f"This order has {children.count()} child order(s)")
    print(f"{'=' * 80}")
    for child in children:
        print(f"\n  Child Order ID: {child.id}")
        print(f"  Child Status: {child.status}")
        print(f"  Child User: {child.user_identifier}")
        print(f"  Child Price: {child.price}")

# Get user info
print(f"\n{'=' * 80}")
print("User Information")
print(f"{'=' * 80}")

try:
    legacy_user = LegacyUser.objects.get(
        id=order.user_id,
        tenant_id=order.tenant_id
    )
    print(f"\nLegacyUser:")
    print(f"  Username: {legacy_user.username}")
    print(f"  Balance: {legacy_user.balance}")
    print(f"  Overdraft: {getattr(legacy_user, 'overdraft_limit', 0)}")
    
    # Try to find Django user
    try:
        django_user = User.objects.get(
            username=legacy_user.username,
            tenant_id=legacy_user.tenant_id
        )
        print(f"\nDjango User:")
        print(f"  Balance: {django_user.balance}")
        print(f"  Overdraft: {django_user.overdraft}")
        
        # Get wallet transactions for this order
        print(f"\n{'=' * 80}")
        print("Wallet Transactions for this order")
        print(f"{'=' * 80}")
        
        transactions = WalletTransaction.objects.filter(
            order_id=str(order.id)
        ).order_by('timestamp')
        
        if transactions.exists():
            for txn in transactions:
                print(f"\n  Transaction ID: {txn.id}")
                print(f"  Type: {txn.transaction_type}")
                print(f"  Amount: {txn.amount}")
                print(f"  Balance Before: {txn.balance_before}")
                print(f"  Balance After: {txn.balance_after}")
                print(f"  Timestamp: {txn.timestamp}")
                print(f"  Description: {txn.description}")
                if txn.metadata:
                    print(f"  Metadata: {txn.metadata}")
        else:
            print("\nNo wallet transactions found for this order!")
            
            # Check all recent wallet transactions for this user
            print(f"\n{'=' * 80}")
            print("Recent wallet transactions for this user (last 10)")
            print(f"{'=' * 80}")
            
            recent_txns = WalletTransaction.objects.filter(
                user_id=django_user.id
            ).order_by('-timestamp')[:10]
            
            for txn in recent_txns:
                print(f"\n  Timestamp: {txn.timestamp}")
                print(f"  Type: {txn.transaction_type}")
                print(f"  Amount: {txn.amount}")
                print(f"  Balance Before: {txn.balance_before}")
                print(f"  Balance After: {txn.balance_after}")
                if txn.order_id:
                    print(f"  Order ID: {txn.order_id}")
                print(f"  Description: {txn.description[:100]}")
        
    except User.DoesNotExist:
        print("\nDjango User not found")
        print("Wallet transactions are only tracked for Django users")
        
except LegacyUser.DoesNotExist:
    print("\nLegacyUser not found!")

print("\n" + "=" * 80)
