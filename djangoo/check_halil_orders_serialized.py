# -*- coding: utf-8 -*-
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User as DjangoUser
from apps.users.legacy_models import LegacyUser
from apps.tenants.models import TenantDomain
from apps.orders.models import ProductOrder
from apps.orders.serializers import OrderListItemSerializer

print("=" * 60)

# Get alsham tenant
domain = TenantDomain.objects.filter(domain='alsham.localhost').first()
tenant_id = domain.tenant_id

# Get Legacy user
legacy_user = LegacyUser.objects.filter(username='halil', tenant_id=tenant_id).first()

# Get recent orders
orders = ProductOrder.objects.filter(
    tenant_id=tenant_id,
    user_id=legacy_user.id
).order_by('-created_at').select_related('product', 'package')[:5]

print(f"Total orders: {ProductOrder.objects.filter(tenant_id=tenant_id, user_id=legacy_user.id).count()}")
print(f"\nRecent 5 orders:")
for order in orders:
    print(f"  - {order.id}: {order.status} - {order.created_at}")
    print(f"    Product: {order.product}")
    print(f"    Package: {order.package}")

print(f"\nSerializing orders:")
serialized = OrderListItemSerializer(orders, many=True)
print(f"Serialized data count: {len(serialized.data)}")
for item in serialized.data:
    print(f"  - {item.get('id')}: {item.get('status')}")

print("=" * 60)
