import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("Searching for orders containing '704'...")
orders = ProductOrder.objects.filter(
    id__icontains='704'
).order_by('-created_at')[:10]

print(f"\nFound {orders.count()} orders:")
for o in orders:
    print(f"\n{o.id}")
    print(f"  Package: {o.package.name if o.package else 'N/A'}")
    print(f"  User: {o.user.username if o.user else 'N/A'}")
    print(f"  Status: {o.status}")
    print(f"  Provider ID: {o.provider_id}")
    print(f"  Created: {o.created_at}")
