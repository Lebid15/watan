#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-}"
MSG="${2:-يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.}"
if [[ "$MODE" != "on" && "$MODE" != "off" ]]; then
  echo "Usage: $0 <on|off> [message]" >&2
  exit 1
fi

echo "Setting MAINTENANCE=$MODE"
export MAINTENANCE="$MODE"
sed -i "s/^MAINTENANCE=.*/MAINTENANCE=$MODE/;t; $ a MAINTENANCE=$MODE" .env 2>/dev/null || true

if grep -q '^MAINTENANCE_MESSAGE=' .env 2>/dev/null; then
  sed -i "s/^MAINTENANCE_MESSAGE=.*/MAINTENANCE_MESSAGE=$MSG/" .env || true
else
  echo "MAINTENANCE_MESSAGE=$MSG" >> .env || true
fi

MAINTENANCE="$MODE" docker compose up -d --no-deps nginx
docker compose exec -T nginx nginx -s reload || true

echo "Done."
