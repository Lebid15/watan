"""
Check talin user's tenant
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.tenancy.models import Tenant

user = User.objects.get(username='talin')
print(f"User: {user.username}")
print(f"Tenant ID: {user.tenant_id}")

try:
    tenant = Tenant.objects.get(id=user.tenant_id)
    print(f"Tenant domain: {tenant.domain}")
    print(f"Tenant name: {tenant.name}")
    print(f"\n✅ This is the shamtech user!")
    print(f"\nCorrect API Token: {user.api_token}")
    print(f"Token in integration: dddd18757177f50f4419d5e6ce567852fbc54803")
    print(f"\n⚠️  These tokens are DIFFERENT!")
    print(f"   Database has:    {user.api_token}")
    print(f"   Integration has: dddd18757177f50f4419d5e6ce567852fbc54803")
    
except Tenant.DoesNotExist:
    print(f"❌ Tenant not found: {user.tenant_id}")
