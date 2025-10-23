from apps.orders.models import ProductOrder

print("="*70)
print("TRACKING ORDERS")
print("="*70)

# Order 1: Original in Alsham
order1 = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')
print("\nORDER #1 (ALSHAM - الشام)")
print("-" * 70)
print(f"Order ID: {order1.id}")
print(f"Tenant ID: {order1.tenant_id}")
print(f"Status: {order1.status}")
print(f"External Status: {order1.external_status}")
print(f"External Order ID: {order1.external_order_id}")

# Order 2: Check if new order exists in ShamTech
new_order_id = 'c98ea6ff-a5ea-4945-8004-964089c51055'
try:
    order2 = ProductOrder.objects.get(id=new_order_id)
    print("\nORDER #2 (SHAMTECH - شام تيك)")
    print("-" * 70)
    print(f"Order ID: {order2.id}")
    print(f"Tenant ID: {order2.tenant_id}")
    print(f"Status: {order2.status}")
    print(f"External Status: {order2.external_status}")
    print(f"External Order ID: {order2.external_order_id}")
    print(f"User ID: {order2.user_identifier}")
    
    print("\n" + "="*70)
    print("SUCCESS! Order was forwarded from ALSHAM to SHAMTECH!")
    print("="*70)
    print(f"ALSHAM order: {str(order1.id)[-6:].upper()}")
    print(f"  --FORWARDED TO-->")
    print(f"SHAMTECH order: {str(order2.id)[-6:].upper()}")
    
except ProductOrder.DoesNotExist:
    print(f"\nOrder {new_order_id} NOT FOUND!")
    print("Forwarding may have failed.")

print("\n" + "="*70)
