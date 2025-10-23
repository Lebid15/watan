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

print("=" * 60)

# Get alsham tenant
domain = TenantDomain.objects.filter(domain='alsham.localhost').first()
tenant_id = domain.tenant_id

# Get Django user
django_user = DjangoUser.objects.filter(username='halil', tenant_id=tenant_id).first()
print(f"Django User ID: {django_user.id} (type: {type(django_user.id).__name__})")

# Get Legacy user
legacy_user = LegacyUser.objects.filter(username='halil', tenant_id=tenant_id).first()
print(f"Legacy User ID: {legacy_user.id} (type: {type(legacy_user.id).__name__})")

# Check orders
orders_count = ProductOrder.objects.filter(
    tenant_id=tenant_id,
    user_id=legacy_user.id
).count()
print(f"Total orders for legacy user: {orders_count}")

# Simulate resolution
print(f"\nSimulating resolution:")
print(f"Checking user.id ({django_user.id}) against LegacyUser...")
try:
    found = LegacyUser.objects.get(id=django_user.id, tenant_id=tenant_id)
    print(f"Found by ID: {found.username}")
except LegacyUser.DoesNotExist:
    print(f"NOT found by Django user ID")
    print(f"Falling back to email search...")
    found_by_email = LegacyUser.objects.filter(tenant_id=tenant_id, email__iexact=django_user.email).first()
    if found_by_email:
        print(f"Found by email: {found_by_email.username} (ID: {found_by_email.id})")
    else:
        print(f"NOT found by email either")

print("=" * 60)
