import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from django.db.models import Q

print("=" * 80)
print("🔍 Checking Order cb8257e0 (ALSHAM)")
print("=" * 80)

order = ProductOrder.objects.filter(id__startswith='cb8257').first()

if order:
    print(f"\n✅ Found order:")
    print(f"  Order ID: {order.id}")
    print(f"  Status: '{order.status}' (type: {type(order.status).__name__})")
    print(f"  Status lower: '{order.status.lower()}'")
    print(f"  Provider ID: {order.provider_id}")
    print(f"  External Order ID: {order.external_order_id}")
    print(f"  External Status: {order.external_status}")
    
    # Test each condition
    print(f"\n🔍 Testing Celery Query Conditions:")
    
    # Condition 1: status
    cond1 = order.status == 'pending' or order.status == 'processing'
    print(f"  1. status == 'pending' or 'processing': {cond1} ❌")
    
    cond1_lower = order.status.lower() == 'pending' or order.status.lower() == 'processing'
    print(f"     (with .lower()): {cond1_lower} ✅")
    
    # Condition 2: provider_id
    cond2 = order.provider_id is not None and order.provider_id != ''
    print(f"  2. provider_id not null/empty: {cond2} ✅")
    
    # Condition 3: external_order_id
    cond3 = order.external_order_id is not None and order.external_order_id != ''
    print(f"  3. external_order_id not null/empty: {cond3} {'✅' if cond3 else '❌'}")
    
    # Condition 4: external_status
    cond4 = order.external_status not in ['completed', 'rejected', 'cancelled', 'failed']
    print(f"  4. external_status not in excluded list: {cond4} ✅")
    
    print(f"\n💡 Problem:")
    if not cond1:
        print(f"  ❌ Status is 'PENDING' (uppercase), but query looks for 'pending' (lowercase)!")
        print(f"  ❌ Celery query needs to use .lower() or iexact!")
    
    if not cond3:
        print(f"  ❌ external_order_id is NULL!")
        print(f"  ❌ This means the order was NOT successfully dispatched to diana!")

# Check the actual query
print(f"\n" + "=" * 80)
print("🔍 Testing Actual Celery Query:")
print("=" * 80)

# Current query (case-sensitive)
current_query = ProductOrder.objects.filter(
    Q(status='pending') | Q(status='processing'),
    Q(provider_id__isnull=False) & ~Q(provider_id=''),
    Q(external_order_id__isnull=False) & ~Q(external_order_id='')
).exclude(
    external_status__in=['completed', 'rejected', 'cancelled', 'failed']
)

print(f"\n📊 Current query (case-sensitive): {current_query.count()} orders")

# Fixed query (case-insensitive)
fixed_query = ProductOrder.objects.filter(
    Q(status__iexact='pending') | Q(status__iexact='processing'),
    Q(provider_id__isnull=False) & ~Q(provider_id=''),
    Q(external_order_id__isnull=False) & ~Q(external_order_id='')
).exclude(
    external_status__in=['completed', 'rejected', 'cancelled', 'failed']
)

print(f"📊 Fixed query (case-insensitive): {fixed_query.count()} orders")

if fixed_query.count() > 0:
    print(f"\n✅ With case-insensitive query, found {fixed_query.count()} order(s):")
    for o in fixed_query:
        print(f"\n  Order: {str(o.id)[:8]}")
        print(f"    Status: {o.status}")
        print(f"    Provider ID: {o.provider_id}")
        print(f"    External Order ID: {o.external_order_id or 'NULL'}")

print("\n" + "=" * 80)
