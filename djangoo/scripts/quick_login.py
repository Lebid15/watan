import os
import json
import requests

BASE = os.environ.get('DJ_API_BASE', 'http://127.0.0.1:8000/api-dj')
TENANT = os.environ.get('DJ_TENANT', 'alsham.localhost')
EMAIL = os.environ.get('DJ_EMAIL', 'owner@example.com')
PASSWORD = os.environ.get('DJ_PASSWORD', 'Pass123!')

def main():
    url = f"{BASE}/auth/login"
    headers = { 'X-Tenant-Host': TENANT, 'Content-Type': 'application/json' }
    body = { 'emailOrUsername': EMAIL, 'password': PASSWORD }
    try:
        r = requests.post(url, headers=headers, json=body, timeout=10)
        print('STATUS', r.status_code)
        print('CT', r.headers.get('Content-Type'))
        print('BODY', r.text[:500])
    except Exception as e:
        print('EXC', type(e).__name__, str(e))

if __name__ == '__main__':
    main()
