import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# Find orders that have loop issue (same order and parent)
loop_orders = []
all_orders = ProductOrder.objects.filter(
    external_order_id__isnull=False,
    status='pending'
).order_by('-created_at')[:50]

for order in all_orders:
    if str(order.id) == str(order.external_order_id):
        loop_orders.append(order)

print(f"Found {len(loop_orders)} orders with loop issue")

for order in loop_orders:
    print(f"\n Order {str(order.id)[:6]}:")
    print(f"   - Provider: {order.provider_id}")
    print(f"   - Status: {order.status}")
    
    # Set to manual
    order.provider_id = None
    order.external_status = 'manual_required'
    current_notes = order.notes if isinstance(order.notes, list) else []
    current_notes.append("[AUTO→MANUAL] Loop detected - switched to manual processing")
    order.notes = current_notes
    order.notes_count = len(current_notes)
    order.save(update_fields=['provider_id', 'external_status', 'notes', 'notes_count'])
    
    print(f"   ✓ Fixed - switched to Manual")

print(f"\n✓ Fixed {len(loop_orders)} orders")
