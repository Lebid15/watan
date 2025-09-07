#!/usr/bin/env bash
set -euo pipefail
HOST=""; NAME=""; EMAIL=""; PASS="";
while [[ $# -gt 0 ]]; do
  case $1 in
    --host) HOST="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    --admin-email) EMAIL="$2"; shift 2;;
    --admin-pass) PASS="$2"; shift 2;;
    *) echo "Unknown arg $1"; exit 1;;
  esac
done
if [[ -z "$HOST" || -z "$NAME" || -z "$EMAIL" || -z "$PASS" ]]; then
  echo "Usage: provision-store.sh --host sub.wtn4.com --name 'Store Name' --admin-email a@b.com --admin-pass pass" >&2
  exit 1
fi

echo "[1/2] Creating/Upserting tenant + admin..." >&2
OUT=$(cd backend && npx ts-node -r tsconfig-paths/register src/scripts/create-tenant.ts --host "$HOST" --name "$NAME" --admin-email "$EMAIL" --admin-pass "$PASS")
echo "$OUT" | jq '.' || echo "$OUT"

SUB=${HOST%%.wtn4.com}
ORIGIN="https://$HOST"

sleep 1

echo "[2/2] Verifying tenant current endpoint..." >&2
curl -sS -H "Origin: $ORIGIN" -H "Host: api.wtn4.com" https://api.wtn4.com/api/tenant/current || true

echo "DONE" >&2
