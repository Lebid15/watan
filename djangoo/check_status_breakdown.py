from apps.orders.models import ProductOrder

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("ORDER STATUS BREAKDOWN IN SHAMTECH")
print("="*70)

all_orders = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).order_by('-created_at')

# Group by status
from collections import Counter
status_count = Counter([o.status for o in all_orders])

print(f"\nTotal orders: {all_orders.count()}")
print("\nBy Status:")
for status, count in status_count.most_common():
    print(f"  {status}: {count}")

# Show recent orders with all details
print("\n" + "="*70)
print("RECENT 10 ORDERS")
print("="*70)

for i, order in enumerate(all_orders[:10], 1):
    print(f"\n{i}. Order: {str(order.id)[-6:].upper()}")
    print(f"   Status: {order.status}")
    print(f"   External Status: {order.external_status}")
    print(f"   User Identifier: {order.user_identifier}")
    print(f"   Created: {order.created_at}")

print("\n" + "="*70)
print("RECOMMENDATION")
print("="*70)

pending_count = status_count.get('pending', 0) + status_count.get('PENDING', 0)
print(f"\nPending orders: {pending_count}")

if pending_count > 0:
    print("✅ There ARE pending orders - check frontend filters!")
    print("   Suggestion: Remove status filter or select 'All' in dropdown")
else:
    print("❌ No pending orders - all are rejected/approved")
    print("   Frontend might be filtering by status='pending' by default")

print("\n" + "="*70)
