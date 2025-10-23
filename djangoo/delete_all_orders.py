from apps.orders.models import ProductOrder

print("="*70)
print("DELETING ALL ORDERS FROM DATABASE")
print("="*70)

# Count orders before deletion
total_orders = ProductOrder.objects.all().count()
print(f"\nTotal orders before deletion: {total_orders}")

# Count by tenant
alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

alsham_count = ProductOrder.objects.filter(tenant_id=alsham_tenant_id).count()
shamtech_count = ProductOrder.objects.filter(tenant_id=shamtech_tenant_id).count()
others_count = total_orders - alsham_count - shamtech_count

print(f"\nOrders by tenant:")
print(f"  Alsham: {alsham_count}")
print(f"  ShamTech: {shamtech_count}")
print(f"  Others: {others_count}")

# Delete ALL orders
print("\n" + "="*70)
print("DELETING...")
print("="*70)

deleted_count = ProductOrder.objects.all().delete()

print(f"\n✅ Deleted: {deleted_count[0]} orders")
print(f"   Affected tables: {deleted_count[1]}")

# Verify
remaining = ProductOrder.objects.all().count()
print(f"\n✅ Remaining orders: {remaining}")

if remaining == 0:
    print("\n✅✅✅ SUCCESS! All orders deleted!")
    print("\nNow you can create a fresh order and test the infinite loop!")
else:
    print(f"\n⚠️ Warning: {remaining} orders still remain")

print("\n" + "="*70)
