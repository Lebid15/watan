"""
Test Internal Adapter catalog fetching
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.internal import InternalAdapter, InternalCredentials

# Get the shamtech integration
integration = Integration.objects.get(id='0e1d1215-cdb8-44b7-a677-0f478f84f370')
print(f"Integration: {integration.name}")
print(f"Base URL: {integration.base_url}")
print(f"API Token: {integration.api_token}\n")

# Create credentials
creds = InternalCredentials(
    base_url=integration.base_url,
    api_token=integration.api_token
)

# Create adapter and fetch catalog
adapter = InternalAdapter()
print("Fetching catalog...")

try:
    catalog = adapter.fetch_catalog(creds)
    print(f"\n✅ Got {len(catalog)} products:\n")
    
    for i, product in enumerate(catalog, 1):
        print(f"{i}. {product.get('name')}")
        print(f"   Referans: {product.get('referans')}")
        print(f"   Cost: {product.get('cost')}")
        print(f"   Min/Max: {product.get('minQty')}/{product.get('maxQty')}")
        print()
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
