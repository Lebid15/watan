import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tenants.models import Tenant

print("Tenant IDs:")
for tenant in Tenant.objects.all():
    print(f"  {tenant.name}: {tenant.id}")
