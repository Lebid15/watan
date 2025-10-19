"""
Check the forwarded order state
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# ShamTech order (forwarded from Al-Sham)
shamtech_order_id = "fe1db7e9-0bdf-4271-aa04-0b15346f058a"
order = ProductOrder.objects.filter(id=shamtech_order_id).first()

print("\n" + "="*80)
print("State Check for try_auto_dispatch_async")
print("="*80 + "\n")

print(f"Order ID: {str(order.id)[:6].upper()}")
print(f"Status: {order.status}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")
print(f"Mode: {order.mode}")

print("\n" + "="*80)
print("Conditions Check")
print("="*80 + "\n")

# Condition 1: Terminal status
is_terminal = order.status in ('approved', 'rejected', 'failed')
print(f"1. Is terminal status? {is_terminal}")
print(f"   → Status: {order.status}")
if is_terminal:
    print(f"   → Would SKIP ❌")
else:
    print(f"   → Pass ✅")

# Condition 2: External order ID exists
has_external = bool(order.external_order_id)
is_stub = order.external_order_id and order.external_order_id.startswith('stub-')
print(f"\n2. Has external_order_id? {has_external}")
print(f"   → external_order_id: {order.external_order_id}")
print(f"   → Is stub? {is_stub}")
if has_external and not is_stub:
    print(f"   → Would SKIP ❌ (OLD LOGIC)")
    print(f"   → Need to fix this!")
else:
    print(f"   → Pass ✅")

# Condition 3: Already dispatched
has_provider = bool(order.provider_id)
is_not_pending = order.status != 'pending'
print(f"\n3. Already dispatched?")
print(f"   → Has provider_id? {has_provider} ({order.provider_id})")
print(f"   → Is not pending? {is_not_pending}")
if not is_stub and has_provider and is_not_pending:
    print(f"   → Would SKIP ❌")
else:
    print(f"   → Pass ✅")

print("\n" + "="*80)
print("Result")
print("="*80 + "\n")

if is_terminal:
    print("❌ BLOCKED by condition 1 (terminal status)")
elif has_external and not is_stub:
    print("❌ BLOCKED by condition 2 (external_order_id exists) ← THIS IS THE PROBLEM!")
elif not is_stub and has_provider and is_not_pending:
    print("❌ BLOCKED by condition 3 (already dispatched)")
else:
    print("✅ Would proceed to auto-dispatch")

print("\n" + "="*80)
