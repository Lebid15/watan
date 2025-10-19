#!/usr/bin/env python
"""
Check if package 263 exists in ZNET
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.znet import ZnetAdapter

print("="*80)
print("CHECKING ZNET PACKAGE 263")
print("="*80)

# Get ZNET integration
znet = Integration.objects.get(id="6d8790a9-9930-4543-80aa-b0b92aa16404")
print(f"ZNET Integration: {znet.name}")
print(f"Base URL: {znet.base_url}")

# Create adapter
adapter = ZnetAdapter()

# Get all products from ZNET
print(f"\nFetching all products from ZNET...")
try:
    # Create credentials from integration
    from apps.providers.adapters.znet import ZnetCredentials
    creds = ZnetCredentials(
        base_url=znet.base_url,
        kod=znet.kod,
        sifre=znet.sifre
    )
    products = adapter.list_products(creds)
    print(f"Found {len(products)} products")
    
    # Look for package 263
    package_263 = None
    for product in products:
        if str(product.get('externalId')) == '263':
            package_263 = product
            break
    
    if package_263:
        print(f"\nPackage 263 found:")
        print(f"  External ID: {package_263.get('externalId')}")
        print(f"  Name: {package_263.get('name', 'N/A')}")
        print(f"  Price: {package_263.get('price', 'N/A')}")
        print(f"  Status: {package_263.get('status', 'N/A')}")
        print(f"  Full data: {package_263}")
    else:
        print(f"\nPackage 263 NOT FOUND!")
        print(f"Available external IDs (first 20):")
        for i, product in enumerate(products[:20]):
            print(f"  {i+1}. ID: {product.get('externalId')} - {product.get('name', 'N/A')}")
        
        # Look for similar packages
        print(f"\nLooking for similar packages...")
        for product in products:
            name = product.get('name', '').lower()
            if 'pubg' in name or 'global' in name or '325' in name:
                print(f"  Found: ID {product.get('externalId')} - {product.get('name')}")
    
except Exception as e:
    print(f"Error fetching products: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("CHECK COMPLETE")
print("="*80)
