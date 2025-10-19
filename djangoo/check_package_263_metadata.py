#!/usr/bin/env python
"""
Check package 263 metadata in ZNET
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.znet import ZnetAdapter, ZnetCredentials

print("="*80)
print("CHECKING PACKAGE 263 METADATA")
print("="*80)

# Get ZNET integration
znet = Integration.objects.get(id="6d8790a9-9930-4543-80aa-b0b92aa16404")
print(f"ZNET Integration: {znet.name}")

# Create adapter and get products
adapter = ZnetAdapter()
creds = ZnetCredentials(
    base_url=znet.base_url,
    kod=znet.kod,
    sifre=znet.sifre
)

print(f"\nFetching products from ZNET...")
try:
    products = adapter.list_products(creds)
    print(f"Found {len(products)} products")
    
    # Find package 263
    package_263 = None
    for product in products:
        if str(product.get('externalId')) == '263':
            package_263 = product
            break
    
    if package_263:
        print(f"\nPackage 263 details:")
        print(f"  External ID: {package_263.get('externalId')}")
        print(f"  Name: {package_263.get('name')}")
        print(f"  Category: {package_263.get('category')}")
        meta = package_263.get('meta', {})
        print(f"\nMetadata analysis:")
        print(f"  oyun_bilgi_id: {meta.get('oyun_bilgi_id')}")
        print(f"  kupur: {meta.get('kupur')}")
        print(f"  currency: {meta.get('currency')}")
        
        # Check raw data safely
        raw_data = meta.get('raw', {})
        print(f"  Raw data keys: {list(raw_data.keys()) if raw_data else 'None'}")
        if raw_data:
            print(f"  Raw oyun_bilgi_id: {raw_data.get('oyun_bilgi_id')}")
            print(f"  Raw kupur: {raw_data.get('kupur')}")
            print(f"  Raw id: {raw_data.get('id')}")
            print(f"  Raw adi: {raw_data.get('adi')}")
        
        # Check what should be sent to ZNET
        print(f"\nWhat should be sent to ZNET:")
        print(f"  oyun (oyun_bilgi_id): {meta.get('oyun_bilgi_id')}")
        print(f"  kupur: {meta.get('kupur')}")
        
        if meta.get('oyun_bilgi_id') and meta.get('kupur'):
            print(f"  ✅ Both oyun_bilgi_id and kupur are available")
        else:
            print(f"  ❌ Missing oyun_bilgi_id or kupur in metadata")
            
    else:
        print(f"Package 263 not found!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
