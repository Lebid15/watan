"""
Script to delete all existing orders (for development only!)
Run: python manage.py shell < scripts/delete_all_orders.py
"""
from apps.orders.models import ProductOrder

def delete_all_orders():
    """Delete all orders from the database"""
    total = ProductOrder.objects.count()
    print(f"Found {total} orders in database")
    
    if total == 0:
        print("No orders to delete")
        return
    
    print(f"⚠️  Deleting ALL {total} orders...")
    deleted_count, _ = ProductOrder.objects.all().delete()
    
    print(f"✅ Deleted {deleted_count} orders successfully!")

delete_all_orders()
