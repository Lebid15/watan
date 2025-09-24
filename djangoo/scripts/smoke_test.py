import json
import sys
from typing import List, Tuple, Optional

import requests


BASE = 'http://127.0.0.1:8000/api-dj'
HDR = { 'X-Tenant-Host': 'localhost' }


def call(method: str, url: str, json_body: Optional[dict] = None) -> Tuple[int, Optional[dict | list | str]]:
    try:
        r = requests.request(method, url, headers=HDR, json=json_body, timeout=10)
        ct = r.headers.get('Content-Type', '')
        data = None
        if 'application/json' in ct:
            try:
                data = r.json()
            except Exception:
                data = None
        elif 'text/csv' in ct:
            data = r.text
        return r.status_code, data
    except Exception as e:
        return -1, str(e)


def main():
    uuid = '00000000-0000-0000-0000-000000000000'
    tests: List[Tuple[str, str, Optional[dict]]] = [
        ('POST', f'{BASE}/admin/integrations/{uuid}/import-catalog', None),
        ('POST', f'{BASE}/admin/integrations/{uuid}/import-catalog?apply=true', None),
        ('POST', f'{BASE}/admin/integrations/{uuid}/import-catalog?apply=true&applyCosts=true&currency=USD', None),
        ('POST', f'{BASE}/admin/integrations/{uuid}/import-catalog?apply=true&hint=fortnite', None),
        ('POST', f'{BASE}/admin/integrations/{uuid}/import-catalog?apply=true&productId={uuid}', None),
        ('GET',  f'{BASE}/admin/providers/coverage', None),
        ('GET',  f'{BASE}/admin/providers/coverage.csv', None),
        ('GET',  f'{BASE}/admin/orders/{uuid}/notes', None),
        ('POST', f'{BASE}/admin/orders/{uuid}/notes', { 'text': 'hi' }),
        ('POST', f'{BASE}/admin/orders/{uuid}/refresh-external', None),
    ]

    for m, u, body in tests:
        code, data = call(m, u, body)
        summary = ''
        if isinstance(data, dict):
            if 'count' in data:
                summary = f"count={data.get('count')}"
            elif 'items' in data and isinstance(data['items'], list):
                summary = f"items={len(data['items'])}"
            elif 'orderId' in data and 'notes' in data:
                summary = f"notes={len(data.get('notes') or [])}"
        elif isinstance(data, list):
            summary = f"list={len(data)}"
        elif isinstance(data, str) and data and u.endswith('.csv'):
            lines = data.strip().splitlines()
            summary = f"csv_lines={len(lines)}"
        print(f"{m} {u} -> {code} {summary}")


if __name__ == '__main__':
    sys.exit(main())
