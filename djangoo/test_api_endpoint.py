import requests
import json

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("TESTING API ENDPOINT DIRECTLY")
print("="*70)

# Simulate frontend API call
url = "http://localhost:8000/api-dj/admin/orders"

headers = {
    'X-Tenant-Host': 'shamtech.localhost',  # أو أي domain لـ ShamTech
}

params = {
    'limit': 20,
}

print(f"\nURL: {url}")
print(f"Headers: {headers}")
print(f"Params: {params}")

try:
    response = requests.get(url, headers=headers, params=params)
    print(f"\nResponse Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        items = data.get('items', [])
        print(f"\n✅ Success! Got {len(items)} orders")
        
        if items:
            print("\nFirst 3 orders:")
            for i, order in enumerate(items[:3], 1):
                order_id = order.get('id', 'N/A')
                short_id = order_id[-6:].upper() if len(order_id) >= 6 else order_id
                status = order.get('status', 'N/A')
                user_id = order.get('userIdentifier', 'N/A')
                print(f"  {i}. {short_id} - Status: {status} - User: {user_id}")
        else:
            print("\n❌ No orders returned!")
            print("This means the API is working but returns empty list.")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    print(f"\n❌ Request failed: {e}")
    print("\nNote: This test requires Django server running on localhost:8000")

print("\n" + "="*70)
