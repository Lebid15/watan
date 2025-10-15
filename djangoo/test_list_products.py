"""
Test list_products method
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.internal import InternalAdapter, InternalCredentials

# Get the shamtech integration
integration = Integration.objects.get(id='0e1d1215-cdb8-44b7-a677-0f478f84f370')
print(f"Integration: {integration.name}\n")

# Create credentials
creds = InternalCredentials(
    base_url=integration.base_url,
    api_token=integration.api_token
)

# Create adapter
adapter = InternalAdapter()

# Test list_products (should work now)
print("Testing list_products()...")
try:
    products = adapter.list_products(creds)
    print(f"✅ Got {len(products)} products\n")
    
    for i, product in enumerate(products[:3], 1):
        print(f"{i}. {product.get('name')}")
        print(f"   Referans: {product.get('referans')}")
        print(f"   Cost: {product.get('cost')}")
        print()
        
except AttributeError as e:
    print(f"❌ AttributeError: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
