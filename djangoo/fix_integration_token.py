"""
Fix the API token in alsham's internal integration
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration

# Find the internal integration for alsham tenant
# It should have provider='internal' and base_url containing shamtech

integrations = Integration.objects.filter(provider='internal')
print(f"Found {integrations.count()} internal integrations:\n")

for integration in integrations:
    print(f"ID: {integration.id}")
    print(f"Name: {integration.name}")
    print(f"Tenant: {integration.tenant_id}")
    print(f"Base URL: {integration.base_url}")
    print(f"Current API Token: {integration.api_token}")
    
    # Check if this is the shamtech integration
    if 'shamtech' in str(integration.base_url).lower():
        print(f"\n✅ This is the shamtech integration!")
        
        correct_token = 'dddd1875717f750f4419d5e6ce567852fbc54803'
        
        if integration.api_token != correct_token:
            print(f"\n⚠️  Token is WRONG!")
            print(f"   Current: {integration.api_token}")
            print(f"   Correct: {correct_token}")
            print(f"\n   Fixing...")
            
            integration.api_token = correct_token
            integration.save()
            
            print(f"   ✅ Token updated!")
        else:
            print(f"\n✅ Token is already correct!")
    
    print("\n" + "="*80 + "\n")
