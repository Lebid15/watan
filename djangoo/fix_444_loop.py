import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("\nFixing self-loop orders for user_identifier=444...\n")

# Find orders where id == external_order_id (self-referencing loop)
loop_orders = []
orders = ProductOrder.objects.filter(user_identifier='444', external_order_id__isnull=False)

for order in orders:
    if str(order.id) == str(order.external_order_id)[:36]:  # Compare first 36 chars (UUID)
        loop_orders.append(order)

if not loop_orders:
    print("No loop orders found!")
else:
    print(f"Found {len(loop_orders)} order(s) with self-loop issue:\n")
    
    for order in loop_orders:
        print(f"Order {str(order.id)[:6]}:")
        print(f"  - Provider: {order.provider_id}")
        print(f"  - Status: {order.external_status}")
        
        # Fix the order
        order.provider_id = None  # Display as "Manual"
        order.external_status = 'manual_required'
        
        # Handle notes field
        current_notes = order.notes if isinstance(order.notes, list) else []
        current_notes.append("[AUTO->MANUAL] Loop detected - switched to manual processing")
        order.notes = current_notes
        order.notes_count = len(current_notes)
        
        order.save(update_fields=['provider_id', 'external_status', 'notes', 'notes_count'])
        
        print(f"  ✓ Fixed - switched to Manual\n")
    
    print(f"✓ Fixed {len(loop_orders)} order(s)")
