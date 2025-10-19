#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tenants.models import Tenant

print("=== FINDING ALL TENANTS ===")

tenants = Tenant.objects.all()
for tenant in tenants:
    print(f"  - {tenant.id} - {tenant.name}")

print(f"\nTotal tenants: {tenants.count()}")




