"""
Check Khalil's wallet transactions
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
print("Checking Khalil's wallet transactions")
print("=" * 80)

# Find Khalil's user
khalil_orders = ProductOrder.objects.filter(
    Q(user_identifier__icontains='khalil') | Q(user_identifier__icontains='خليل')
).order_by('-created_at').first()

if not khalil_orders:
    print("No orders found for Khalil")
    sys.exit(1)

print(f"\nFound order for user_id: {khalil_orders.user_id}")
print(f"Tenant ID: {khalil_orders.tenant_id}")

# Get LegacyUser
try:
    legacy_user = LegacyUser.objects.get(
        id=khalil_orders.user_id,
        tenant_id=khalil_orders.tenant_id
    )
    print(f"\nLegacyUser balance: {legacy_user.balance}")
    print(f"LegacyUser overdraft: {getattr(legacy_user, 'overdraft_limit', 0)}")
except LegacyUser.DoesNotExist:
    print("\nLegacyUser not found")
    legacy_user = None

# Get Django User
if legacy_user:
    try:
        django_user = User.objects.get(
            username=legacy_user.username,
            tenant_id=legacy_user.tenant_id
        )
        print(f"\nDjango User balance: {django_user.balance}")
        print(f"Django User overdraft: {getattr(django_user, 'overdraft', 0)}")
        
        # Get wallet transactions (last 10)
        transactions = WalletTransaction.objects.filter(
            user_id=django_user.id
        ).order_by('-timestamp')[:10]
        
        print(f"\n\nLast {len(transactions)} wallet transactions:")
        print("=" * 80)
        for txn in transactions:
            print(f"\n  Timestamp: {txn.timestamp}")
            print(f"  Type: {txn.transaction_type}")
            print(f"  Amount: {txn.amount}")
            print(f"  Balance Before: {txn.balance_before}")
            print(f"  Balance After: {txn.balance_after}")
            print(f"  Description: {txn.description}")
            if txn.order_id:
                print(f"  Order ID: {txn.order_id}")
            if txn.metadata:
                print(f"  Metadata: {txn.metadata}")
        
    except User.DoesNotExist:
        print("\nDjango User not found")

print("\n" + "=" * 80)
