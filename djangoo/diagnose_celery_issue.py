import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 WHY Celery is NOT checking PENDING orders?")
print("=" * 80)

# Check alsham tenant
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

# Get PENDING orders
pending_orders = ProductOrder.objects.filter(
    tenant_id=alsham_tenant_id,
    status__in=['PENDING', 'pending', 'PROCESSING', 'processing']
).order_by('-created_at')

print(f"\n📦 PENDING/PROCESSING orders in alsham: {pending_orders.count()}")

for order in pending_orders:
    print(f"\n  Order: {str(order.id)[:6]}")
    print(f"    Status: {order.status}")
    print(f"    Mode: {order.mode}")
    print(f"    External Status: {order.external_status}")
    print(f"    Provider ID: {order.provider_id or 'NOT SET'}")
    print(f"    Created: {order.created_at}")

# Now let's check the task logic
print("\n" + "=" * 80)
print("🔍 Checking task logic in check_pending_orders_batch")
print("=" * 80)

# Simulate the query from the task
from django.db.models import Q

# This is what the task does
orders_to_check = ProductOrder.objects.filter(
    Q(status='pending') | Q(status='processing'),
    Q(provider_id__isnull=False) & ~Q(provider_id=''),
    Q(external_order_id__isnull=False) & ~Q(external_order_id='')
).exclude(
    external_status__in=['completed', 'rejected', 'cancelled', 'failed']
).order_by('-created_at')[:50]

print(f"\n📊 Orders matching task query: {orders_to_check.count()}")

if orders_to_check.count() == 0:
    print("\n❌ Problem found!")
    print("   The task requires:")
    print("     1. status = 'pending' or 'processing'")
    print("     2. provider_id is NOT NULL and NOT empty")
    print("     3. external_order_id is NOT NULL and NOT empty")
    print("     4. external_status NOT IN ('completed', 'rejected', 'cancelled', 'failed')")
    print("\n   But order a720bc has:")
    order = pending_orders.first()
    if order:
        print(f"     ✅ status = '{order.status}' (good)")
        print(f"     ❌ provider_id = '{order.provider_id or 'NULL'}' (NOT SET!)")
        print(f"     ❌ external_order_id = '{order.external_order_id or 'NULL'}' (NOT SET!)")
        print(f"     ✅ external_status = '{order.external_status}' (good)")
        
        print("\n💡 Solution:")
        print("   Order needs to be DISPATCHED first!")
        print("   After dispatch:")
        print("     - provider_id will be set")
        print("     - external_order_id will be set")
        print("     - Then Celery can check its status!")

print("\n" + "=" * 80)
