"""
Test internal API with correct token
"""
import requests

# The correct token for talin@shamtech
api_token = 'dddd1875717f750f4419d5e6ce567852fbc54803'
tenant_host = 'shamtech.localhost'

# Test 1: Get user profile (balance)
url_profile = 'http://127.0.0.1:8000/api-dj/users/profile'
headers_profile = {
    'api-token': api_token,
    'X-Tenant-Host': tenant_host,
}

print(f"Testing profile endpoint...")
print(f"URL: {url_profile}")
print(f"Headers: {headers_profile}\n")

response = requests.get(url_profile, headers=headers_profile)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}\n")

# Test 2: Get products catalog
url_products = 'http://127.0.0.1:8000/api-dj/products'
headers_products = {
    'api-token': api_token,
    'X-Tenant-Host': tenant_host,
}

print(f"\nTesting products endpoint...")
print(f"URL: {url_products}")
print(f"Headers: {headers_products}\n")

response = requests.get(url_products, headers=headers_products)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    if isinstance(data, list):
        print(f"✅ Got {len(data)} products")
        if len(data) > 0:
            print(f"\nFirst product: {data[0]}")
    else:
        print(f"Response: {data}")
else:
    print(f"Error: {response.text[:500]}")
