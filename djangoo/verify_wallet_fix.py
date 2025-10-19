"""
Quick test to verify wallet refund will work
"""
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from apps.orders.services import _chain_propagation_enabled

print("=" * 80)
print("Wallet Refund Fix Verification")
print("=" * 80)

# Check 1: Feature flag
ff_enabled = _chain_propagation_enabled()
print(f"\n1. FF_CHAIN_STATUS_PROPAGATION: {'✅ ENABLED' if ff_enabled else '❌ DISABLED'}")

if not ff_enabled:
    print("\n   ⚠️  ERROR: Chain propagation is disabled!")
    print("   Please restart the Django server and Celery worker.")
    sys.exit(1)

# Check 2: Function exists
try:
    from apps.orders.services import _update_wallet_for_chain_status_change
    print("\n2. _update_wallet_for_chain_status_change: ✅ EXISTS")
except ImportError:
    print("\n2. _update_wallet_for_chain_status_change: ❌ NOT FOUND")
    sys.exit(1)

# Check 3: Function is called from _apply_chain_updates
import inspect
from apps.orders.services import _apply_chain_updates

source = inspect.getsource(_apply_chain_updates)
if "_update_wallet_for_chain_status_change" in source:
    print("\n3. Function is called in _apply_chain_updates: ✅ YES")
else:
    print("\n3. Function is called in _apply_chain_updates: ❌ NO")
    sys.exit(1)

# Check 4: _propagate_chain_status is called from apply_order_status_change
from apps.orders.services import apply_order_status_change

source2 = inspect.getsource(apply_order_status_change)
if "_propagate_chain_status" in source2:
    print("\n4. _propagate_chain_status called from apply_order_status_change: ✅ YES")
else:
    print("\n4. _propagate_chain_status called from apply_order_status_change: ❌ NO")
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ All checks passed!")
print("=" * 80)
print("\nThe wallet refund fix is properly configured.")
print("\nNext steps:")
print("1. Restart Django server (if running)")
print("2. Restart Celery worker (if running)")
print("3. Test with a new order:")
print("   - Create order from Khalil")
print("   - Reject the order")
print("   - Verify wallet is refunded")
print("\n" + "=" * 80)
