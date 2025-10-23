"""Quick manual smoke-test for the Django admin orders endpoint.

Usage (PowerShell):

    $env:DJANGO_ADMIN_USER="admin"
    $env:DJANGO_ADMIN_PASSWORD="admin"
    python scripts/test_admin_orders_api.py

You can also pass command-line flags if you prefer:

    python scripts/test_admin_orders_api.py --user admin --password admin

The script will:
1. Call /api-dj/auth/login to obtain a JWT access token.
2. Use that token with the required X-Tenant headers to call /api-dj/admin/orders.
3. Print the HTTP status and a preview of the returned payload.

Environment variables take precedence; command-line flags are a fallback. The
tenant host / id default to ShamTech values but can be overridden the same way.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from textwrap import dedent
from typing import Dict, Optional

import requests

DEFAULT_BASE_URL = os.environ.get("DJANGO_API_BASE", "http://127.0.0.1:8000/api-dj")
DEFAULT_TENANT_HOST = os.environ.get("DJANGO_TENANT_HOST", "shamtech.localhost")
DEFAULT_TENANT_ID = os.environ.get(
    "DJANGO_TENANT_ID", "7d677574-21be-45f7-b520-22e0fe36b860"
)


def _collect_cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test the admin orders endpoint")
    parser.add_argument("--user", dest="username", help="Admin email/username")
    parser.add_argument("--password", dest="password", help="Admin password")
    parser.add_argument(
        "--tenant-host",
        default=DEFAULT_TENANT_HOST,
        help="Value for X-Tenant-Host header (default: %(default)s)",
    )
    parser.add_argument(
        "--tenant-id",
        default=DEFAULT_TENANT_ID,
        help="Value for X-Tenant-Id header (default: %(default)s)",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="API base URL ending with /api-dj (default: %(default)s)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="How many items to request from /admin/orders (default: %(default)s)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Less verbose output (only status codes and counts)",
    )
    return parser.parse_args()


def _resolve_credentials(cli_namespace: argparse.Namespace) -> Dict[str, str]:
    username = os.environ.get("DJANGO_ADMIN_USER") or cli_namespace.username
    password = os.environ.get("DJANGO_ADMIN_PASSWORD") or cli_namespace.password

    if not username or not password:
        print(
            dedent(
                """
                Missing credentials.
                Either export DJANGO_ADMIN_USER / DJANGO_ADMIN_PASSWORD or pass --user / --password.
                """
            ).strip(),
            file=sys.stderr,
        )
        sys.exit(2)

    return {"emailOrUsername": username, "password": password}


def _login_for_token(base_url: str, payload: Dict[str, str]) -> str:
    login_url = f"{base_url.rstrip('/')}/auth/login"
    response = requests.post(login_url, json=payload, timeout=20)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Login failed ({response.status_code}): {response.text[:200]}"
        )

    data = response.json()
    token = data.get("access") or data.get("token") or data.get("access_token")
    if not token:
        raise RuntimeError("Login succeeded but no access token was returned")
    return token


def _call_admin_orders(
    base_url: str,
    token: str,
    tenant_host: str,
    tenant_id: str,
    limit: int,
) -> requests.Response:
    endpoint = f"{base_url.rstrip('/')}/admin/orders"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Host": tenant_host,
        "X-Tenant-Id": tenant_id,
    }
    response = requests.get(endpoint, headers=headers, params={"limit": limit}, timeout=20)
    return response


def _print_response_preview(resp: requests.Response, quiet: bool = False) -> None:
    print(f"GET {resp.request.url}")
    print(f"Status: {resp.status_code}")

    if resp.status_code == 200:
        try:
            parsed = resp.json()
        except ValueError:
            print("Response did not contain JSON; raw body follows:")
            print(resp.text[:400])
            return

        items = parsed.get("items") if isinstance(parsed, dict) else None
        if isinstance(items, list):
            print(f"Items returned: {len(items)}")
            if not quiet and items:
                preview = items[:3]
                print(json.dumps(preview, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(parsed, indent=2, ensure_ascii=False)[:800])
    else:
        print("Error response preview:")
        body = resp.text
        print(body[:400])



def main() -> None:
    args = _collect_cli_args()
    creds_payload = _resolve_credentials(args)

    try:
        token = _login_for_token(args.base_url, creds_payload)
    except Exception as exc:
        print(f"✖ Login error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        response = _call_admin_orders(
            base_url=args.base_url,
            token=token,
            tenant_host=args.tenant_host,
            tenant_id=args.tenant_id,
            limit=args.limit,
        )
    except Exception as exc:
        print(f"✖ Request error: {exc}", file=sys.stderr)
        sys.exit(1)

    _print_response_preview(response, quiet=args.quiet)
    if response.status_code != 200:
        sys.exit(1)


if __name__ == "__main__":
    main()
