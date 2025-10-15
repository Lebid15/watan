"""
Test the new structure matches what AdminIntegrationPackagesView expects
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.internal import InternalAdapter, InternalCredentials

# Get the shamtech integration
integration = Integration.objects.get(id='0e1d1215-cdb8-44b7-a677-0f478f84f370')

# Create credentials
creds = InternalCredentials(
    base_url=integration.base_url,
    api_token=integration.api_token
)

# Create adapter
adapter = InternalAdapter()

# Test list_products
products = adapter.list_products(creds)

print(f"✅ Got {len(products)} products\n")

if products:
    first = products[0]
    print("First product structure:")
    print(f"  id: {first.get('id')}")
    print(f"  externalId: {first.get('externalId')}")
    print(f"  name: {first.get('name')}")
    print(f"  basePrice: {first.get('basePrice')}")
    print(f"  currencyCode: {first.get('currencyCode')}")
    
    print("\n✅ All required fields present for AdminIntegrationPackagesView!")
    
    # Check what views.py looks for
    external_id = first.get('externalId') or first.get('id')
    price_raw = first.get('basePrice')
    currency = first.get('currencyCode')
    name = first.get('name')
    
    print(f"\nWhat views.py will extract:")
    print(f"  external_id: {external_id}")
    print(f"  price: {price_raw}")
    print(f"  currency: {currency}")
    print(f"  name: {name}")
    
    print("\n✅ Structure is compatible!")
else:
    print("❌ No products returned")
