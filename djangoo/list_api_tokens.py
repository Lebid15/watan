"""
List all users with API tokens
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User

users_with_tokens = User.objects.exclude(api_token__isnull=True).exclude(api_token='')

print(f"Found {users_with_tokens.count()} users with API tokens:\n")

for user in users_with_tokens:
    print(f"{'='*80}")
    print(f"Username: {user.username}")
    print(f"Email: {user.email}")
    print(f"Tenant ID: {user.tenant_id}")
    print(f"Status: {user.status}")
    print(f"API Token: {user.api_token}")
    print(f"API Enabled: {user.api_enabled}")
    print(f"API Revoked: {user.api_token_revoked}")
    print(f"Last Used: {user.api_last_used_at}")
    print()

if users_with_tokens.count() == 0:
    print("❌ No users have API tokens generated!")
    print("\nLet's check shamtech tenant users:")
    from apps.tenancy.models import Tenant
    try:
        shamtech = Tenant.objects.get(domain='shamtech.localhost')
        print(f"\n✅ Found shamtech tenant: {shamtech.id}")
        
        shamtech_users = User.objects.filter(tenant_id=shamtech.id)
        print(f"   Found {shamtech_users.count()} users in shamtech tenant:\n")
        
        for user in shamtech_users:
            print(f"   - {user.username} ({user.email})")
            print(f"     Has token: {'Yes' if user.api_token else 'No'}")
            print(f"     API enabled: {user.api_enabled}")
            print()
    except Tenant.DoesNotExist:
        print("❌ shamtech tenant not found!")
