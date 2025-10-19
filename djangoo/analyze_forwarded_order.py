"""
Check how the forwarded order was created
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
print("🔍 Order Details at ShamTech")
print("="*80 + "\n")

print(f"Order ID: {str(order.id)[:6].upper()}")
print(f"Mode: {order.mode}")
print(f"Status: {order.status}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")
print(f"Root Order ID: {order.root_order_id}")
print(f"Chain Path: {order.chain_path}")

print("\n" + "="*80)
print("❓ Analysis")
print("="*80 + "\n")

if order.mode == 'CHAIN_FORWARD':
    print("✅ This order was created via CHAIN_FORWARD mechanism")
    print("   → Should have triggered try_auto_dispatch")
elif order.mode == 'MANUAL':
    print("❌ This order is marked as MANUAL")
    print("   → Was created via API/Integration forwarding")
    print("   → try_auto_dispatch was NOT called!")
    print("\n💡 SOLUTION:")
    print("   When an order is created via Integration API,")
    print("   we need to call try_auto_dispatch if:")
    print("   - PackageRouting exists for this package")
    print("   - Routing mode = 'auto'")
else:
    print(f"⚠️ Unknown mode: {order.mode}")

print("\n" + "="*80)
