#!/usr/bin/env bash
set -euo pipefail
# Basic tenant isolation probe
# Usage: TENANT_A=store1.wtn4.com TENANT_B=store2.wtn4.com TOKEN_A=... ./tenant_isolation_check.sh

fail() { echo "[FAIL] $1" >&2; exit 1; }
need() { command -v "$1" >/dev/null || fail "Missing dependency: $1"; }

need curl
: "${TENANT_A:?TENANT_A required}";
: "${TENANT_B:?TENANT_B required}";
: "${TOKEN_A:?TOKEN_A (JWT from tenant A) required}";

API=https://api.wtn4.com

function check_diff() {
  local path=$1
  echo "[INFO] Fetching tenant A $path"
  bodyA=$(curl -sS -H "Origin: https://$TENANT_A" -H "X-Tenant-Host: $TENANT_A" -H "Authorization: Bearer $TOKEN_A" "$API$path" || true)
  echo "[INFO] Fetching tenant B (with tenant A token) $path"
  bodyB=$(curl -sS -H "Origin: https://$TENANT_B" -H "X-Tenant-Host: $TENANT_B" -H "Authorization: Bearer $TOKEN_A" "$API$path" || true)
  if [ "$bodyA" != "$bodyB" ]; then
    echo "[PASS] Response differs across tenants as expected ($path)";
  else
    echo "[WARN] SAME response for A vs B ($path) – investigate potential isolation gap";
  fi
}

check_diff /api/products
check_diff /api/orders
check_diff /api/users/me || true

echo "Done."
