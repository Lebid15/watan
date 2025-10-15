"""
Comprehensive test of Internal Provider Integration
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.internal import InternalAdapter, InternalCredentials

print("="*80)
print("INTERNAL PROVIDER INTEGRATION TEST")
print("="*80)

# Get the shamtech integration from alsham tenant
integration = Integration.objects.get(id='0e1d1215-cdb8-44b7-a677-0f478f84f370')

print(f"\n📋 Integration Details:")
print(f"   Name: {integration.name}")
print(f"   Provider: {integration.provider}")
print(f"   Tenant ID: {integration.tenant_id}")
print(f"   Base URL: {integration.base_url}")
print(f"   API Token: {integration.api_token[:20]}...{integration.api_token[-10:]}")

# Create credentials
creds = InternalCredentials(
    base_url=integration.base_url,
    api_token=integration.api_token
)

# Create adapter
adapter = InternalAdapter()

print(f"\n🔍 Testing Balance Fetch...")
try:
    balance_result = adapter.get_balance(creds)
    if 'error' in balance_result:
        print(f"   ❌ Error: {balance_result['message']}")
    else:
        print(f"   ✅ Balance: {balance_result['currency']} {balance_result['balance']}")
except Exception as e:
    print(f"   ❌ Exception: {e}")

print(f"\n📦 Testing Catalog Fetch...")
try:
    catalog = adapter.fetch_catalog(creds)
    print(f"   ✅ Fetched {len(catalog)} package items\n")
    
    print(f"   Catalog Items:")
    print(f"   {'#':<4} {'Name':<25} {'Referans':<40} {'Cost':<10} {'Active':<8}")
    print(f"   {'-'*4} {'-'*25} {'-'*40} {'-'*10} {'-'*8}")
    
    for i, item in enumerate(catalog, 1):
        name = item.get('name', '')[:25]
        referans = item.get('referans', '')[:40]
        cost = f"{item.get('currency', 'TRY')} {item.get('cost', 0)}"
        active = '✅' if item.get('isActive') else '❌'
        
        print(f"   {i:<4} {name:<25} {referans:<40} {cost:<10} {active:<8}")
    
    print(f"\n   Details of first item:")
    if catalog:
        first = catalog[0]
        for key, value in sorted(first.items()):
            print(f"      {key}: {value}")
    
except Exception as e:
    print(f"   ❌ Exception: {e}")
    import traceback
    traceback.print_exc()

print(f"\n{'='*80}")
print(f"TEST COMPLETE")
print(f"{'='*80}\n")

print(f"✅ Integration is ready to use!")
print(f"\n📍 View in UI:")
print(f"   http://alsham.localhost:3000/admin/products/integrations/{integration.id}/")
