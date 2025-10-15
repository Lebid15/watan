"""
Check API token configuration and enable if needed
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User

# Check the token from alsham's integration
token = 'dddd18757177f50f4419d5e6ce567852fbc54803'

try:
    user = User.objects.get(api_token=token)
    print(f"✅ Found user: {user.username}")
    print(f"   Email: {user.email}")
    print(f"   Tenant: {user.tenant_id}")
    print(f"   Status: {user.status}")
    print(f"   API Enabled: {user.api_enabled}")
    print(f"   API Token Revoked: {user.api_token_revoked}")
    print(f"   API Last Used: {user.api_last_used_at}")
    
    if not user.api_enabled:
        print("\n⚠️  API is NOT enabled for this user!")
        print("   Enabling API access...")
        user.api_enabled = True
        user.save(update_fields=['api_enabled'])
        print("   ✅ API access enabled!")
    
    if user.api_token_revoked:
        print("\n⚠️  API token is REVOKED!")
        print("   Un-revoking token...")
        user.api_token_revoked = False
        user.save(update_fields=['api_token_revoked'])
        print("   ✅ Token un-revoked!")
    
    print("\n✅ User is ready for API access!")
    
except User.DoesNotExist:
    print(f"❌ No user found with token: {token}")
