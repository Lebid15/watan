from apps.orders.models import ProductOrder

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'
diana_user_id = 20

print("="*70)
print("FIXING ORDER user_id")
print("="*70)

# Get the order
order = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).first()

if order:
    print(f"\n✅ Found order: {str(order.id)[-6:].upper()}")
    print(f"   Current user_id: {order.user_id}")
    print(f"   Current user_identifier: {order.user_identifier}")
    
    # Update user_id to diana
    old_user_id = order.user_id
    order.user_id = diana_user_id
    order.save()
    
    print(f"\n✅ Updated!")
    print(f"   Old user_id: {old_user_id}")
    print(f"   New user_id: {diana_user_id}")
    print(f"   user_identifier: {order.user_identifier}")
    
    print("\n✅✅✅ SUCCESS!")
    print("Now refresh the admin panel and the order should appear!")
else:
    print("\n❌ No order found!")

print("\n" + "="*70)
