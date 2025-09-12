#!/usr/bin/env bash
set -euo pipefail
# Probe for rudimentary rate limiting on auth endpoint (expected not yet implemented).
# Usage: ORIGIN=https://wtn4.com ATTEMPTS=30 ./scripts/security/rate_limit_probe.sh

API=${API:-https://api.wtn4.com}
ORIGIN=${ORIGIN:-https://wtn4.com}
ATTEMPTS=${ATTEMPTS:-25}

echo "[INFO] Sending $ATTEMPTS rapid login attempts (invalid creds) to observe throttling behavior"
for i in $(seq 1 "$ATTEMPTS"); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/auth/login" \
    -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
    --data '{"email":"fake@example.com","password":"bad"}')
  echo "$i:$code" || true
  # Intentionally minimal sleep to detect lack of rate limiting
done | tee rate-limit-results.txt

echo "[NOTE] Review for consistent 401s with identical latency (indicates no throttling)."
