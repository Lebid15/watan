"""
Test the new condition logic
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
print("NEW CONDITION TEST")
print("="*80 + "\n")

print(f"Order ID: {str(order.id)[:6].upper()}")
print(f"Status: {order.status}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")

print("\n" + "="*80)
print("NEW Condition Check")
print("="*80 + "\n")

has_been_dispatched_to_provider = (
    order.external_order_id and 
    not order.external_order_id.startswith('stub-') and
    order.provider_id and
    order.provider_id not in ('MANUAL', 'CHAIN_FORWARD', '') and
    order.status in ('processing', 'completed', 'approved')
)

print(f"has_been_dispatched_to_provider = {has_been_dispatched_to_provider}")
print()
print("Breaking down:")
print(f"  1. has external_order_id? {bool(order.external_order_id)}")
print(f"  2. NOT stub? {not order.external_order_id.startswith('stub-') if order.external_order_id else False}")
print(f"  3. has provider_id? {bool(order.provider_id)}")
print(f"  4. provider_id NOT in placeholders? {order.provider_id not in ('MANUAL', 'CHAIN_FORWARD', '') if order.provider_id else False}")
print(f"  5. status is terminal/processing? {order.status in ('processing', 'completed', 'approved')}")

print("\n" + "="*80)
print("Result")
print("="*80 + "\n")

if has_been_dispatched_to_provider:
    print("❌ Would SKIP - already dispatched")
else:
    print("✅ Would PROCEED to auto-dispatch!")
    print("\n   This order:")
    print(f"   - Has external_order_id (source order tracking) ✅")
    print(f"   - Has provider_id (intermediate tenant) ✅")
    print(f"   - BUT status is PENDING (not dispatched to final provider yet!) ✅")
    print(f"   - SO it should be auto-dispatched to final provider (ZNET)!")

print("\n" + "="*80)
