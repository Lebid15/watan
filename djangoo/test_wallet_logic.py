"""
Test wallet refund logic with detailed logging
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
from django.db import transaction

# Test the wallet update logic
print("=" * 80)
print("Testing Wallet Update Logic")
print("=" * 80)

# Simulate the scenario
order_id = "907ec99e-0dc9-4141-926d-2b32d4b0c45a"  # Pending order for Khalil

try:
    order = ProductOrder.objects.get(id=order_id)
    print(f"\nOrder found: {order.id}")
    print(f"Status: {order.status}")
    print(f"Price: {order.price}")
    print(f"User ID: {order.user_id}")
    
    # Get user
    legacy_user = LegacyUser.objects.get(
        id=order.user_id,
        tenant_id=order.tenant_id
    )
    print(f"\nLegacyUser balance BEFORE: {legacy_user.balance}")
    
    # Test the logic from _update_wallet_for_chain_status_change
    from apps.orders.services import _quantize, _as_decimal, LEGACY_QUANT
    
    amount_user = order.sell_price_amount if order.sell_price_amount not in (None, "") else order.price
    amount_user_dec = _quantize(_as_decimal(amount_user), LEGACY_QUANT)
    legacy_balance = _quantize(_as_decimal(getattr(legacy_user, "balance", 0)), LEGACY_QUANT)
    
    print(f"\nAmount to refund: {amount_user_dec}")
    print(f"Current balance: {legacy_balance}")
    
    # Calculate what would happen if we reject
    new_status = "rejected"
    prev_status = order.status or "pending"
    
    print(f"\nSimulating status change:")
    print(f"  From: {prev_status}")
    print(f"  To: {new_status}")
    
    if new_status == "rejected" and prev_status != "rejected":
        new_legacy_balance = _quantize(legacy_balance + amount_user_dec, LEGACY_QUANT)
        print(f"\nCalculated new balance: {new_legacy_balance}")
        print(f"Expected change: +{amount_user_dec}")
        print(f"Result: {legacy_balance} + {amount_user_dec} = {new_legacy_balance}")
    else:
        print(f"\nNo balance change (condition not met)")
    
    print(f"\n{'=' * 80}")
    print("Testing approved -> rejected scenario")
    print(f"{'=' * 80}")
    
    # Test approved -> rejected
    prev_status_2 = "approved"
    if new_status == "rejected" and prev_status_2 != "rejected":
        new_legacy_balance_2 = _quantize(legacy_balance + amount_user_dec, LEGACY_QUANT)
        print(f"\nFrom: {prev_status_2}")
        print(f"To: {new_status}")
        print(f"Calculated new balance: {new_legacy_balance_2}")
        print(f"Expected change: +{amount_user_dec}")
        print(f"Result: {legacy_balance} + {amount_user_dec} = {new_legacy_balance_2}")
        
        print(f"\n⚠️  WARNING: This adds money even though order was approved!")
        print(f"   If order was approved, the money was already returned in the original flow.")
        print(f"   Adding it again would DOUBLE the refund!")
    
except ProductOrder.DoesNotExist:
    print(f"\nOrder not found: {order_id}")
except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
