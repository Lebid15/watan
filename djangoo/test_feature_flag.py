"""
Test if FF_CHAIN_STATUS_PROPAGATION is enabled
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

print("=" * 80)
print("Feature Flag Status")
print("=" * 80)

ff_chain = getattr(settings, "FF_CHAIN_STATUS_PROPAGATION", False)
print(f"\nFF_CHAIN_STATUS_PROPAGATION: {ff_chain}")
print(f"Type: {type(ff_chain)}")
print(f"Enabled: {'✅ YES' if ff_chain else '❌ NO'}")

if ff_chain:
    print("\n✅ Chain status propagation is ENABLED")
    print("   - Wallet updates will be triggered when orders are rejected in chain")
else:
    print("\n❌ Chain status propagation is DISABLED")
    print("   - Wallet updates will NOT be triggered!")
    print("   - Please restart the server after enabling this flag")

print("\n" + "=" * 80)
