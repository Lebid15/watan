"""
List all tenants
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tenancy.models import Tenant

tenants = Tenant.objects.all()
print(f"Found {tenants.count()} tenants:\n")

for t in tenants:
    print(f"ID: {t.id}")
    print(f"Domain: {getattr(t, 'domain', 'N/A')}")
    print(f"Name: {getattr(t, 'name', 'N/A')}")
    print(f"Attributes: {[attr for attr in dir(t) if not attr.startswith('_')]}")
    print()
