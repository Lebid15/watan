import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch
import uuid

# Order details
alsham_tenant = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
pubg_package = 'e3ce2ffa-403b-4e25-b43f-48b9a853f5ed'

# Get existing user from Alsham
from apps.orders.models import LegacyUser
alsham_user = LegacyUser.objects.filter(tenant_id=alsham_tenant).first()

if not alsham_user:
    print("ERROR: No user found in Alsham tenant!")
    exit(1)

print(f"Creating order in Alsham with user: {alsham_user.username} (UUID: {alsham_user.id})")

# Create a test order
from django.utils import timezone

order_id = uuid.uuid4()
order = ProductOrder.objects.create(
    id=order_id,
    tenant_id=alsham_tenant,
    status='pending',
    user_id=alsham_user.id,
    package_id=pubg_package,
    quantity=1,
    sell_price_currency='USD',
    sell_price_amount=10.00,
    price=10.00,
    user_identifier='test_player_123',
    created_at=timezone.now(),
    notes={}  # Empty JSON object
)

print(f"✅ Order created: {order.id}")
print(f"   Short ID: {str(order.id)[:6].upper()}")

# Try auto-dispatch
print("\n" + "="*50)
print("ATTEMPTING AUTO-DISPATCH...")
print("="*50)

try:
    result = try_auto_dispatch(order)
    print(f"\n✅ Auto-dispatch completed!")
    print(f"   Result: {result}")
except Exception as e:
    print(f"\n❌ Auto-dispatch failed!")
    print(f"   Error: {e}")
    import traceback
    traceback.print_exc()
