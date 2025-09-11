#!/usr/bin/env bash
set -euo pipefail
MODE=${1:-}
MESSAGE=${2:-يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.}
if [[ -z "$MODE" || ! "$MODE" =~ ^(on|off)$ ]]; then
  echo "Usage: $0 <on|off> [message]" >&2
  exit 2
fi
SWITCH=nginx/maintenance.switch
MSGFILE=nginx/maintenance.message.json
mkdir -p nginx || true
printf "%s\n" "$MODE" > "$SWITCH"
if [[ -n "$MESSAGE" ]]; then
  # JSON encode the message (simple escape quotes)
  esc=$(printf '%s' "$MESSAGE" | sed 's/"/\\"/g')
  cat > "$MSGFILE.tmp" <<EOF
{
  "message": "$esc",
  "updatedAt": "$(date -u +%FT%TZ)"
}
EOF
  mv "$MSGFILE.tmp" "$MSGFILE"
fi
CID=$(docker ps --format '{{.Names}}' | grep -E '^watan-nginx$' || true)
if [[ -n "$CID" ]]; then
  docker cp "$SWITCH" "$CID":/etc/nginx/conf.d/maintenance.switch
  if [[ -f "$MSGFILE" ]]; then
    docker cp "$MSGFILE" "$CID":/etc/nginx/conf.d/maintenance.message.json || true
  fi
  docker exec "$CID" nginx -t
  docker exec "$CID" nginx -s reload
  echo "[OK] maintenance switched $MODE"
else
  echo "[WARN] nginx container not found; files written locally only"
fi
echo "Done." 
