from apps.orders.models import ProductOrder

print("="*70)
print("DELETING OLD FAILED ORDERS")
print("="*70)

# Delete all orders
deleted = ProductOrder.objects.all().delete()

print(f"\n✅ Deleted {deleted[0]} orders")
print("\n✅ Database is clean! Ready for fresh test!")

print("\n" + "="*70)
print("NOW CREATE A NEW ORDER FROM ALSHAM")
print("="*70)
print("\nThe new order should:")
print("  1. Be created in Alsham")
print("  2. Auto-forward to ShamTech")
print("  3. Appear in ShamTech admin panel with correct user_id")
print("\n" + "="*70)
