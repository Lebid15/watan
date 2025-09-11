#!/usr/bin/env bash
set -euo pipefail
MODE=${1:-}
MESSAGE=${2:-يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.}
if [[ -z "$MODE" || ! "$MODE" =~ ^(on|off)$ ]]; then
  echo "Usage: $0 <on|off> [message]" >&2; exit 2; fi
SRC="nginx/mode.$MODE.conf"
[[ -f "$SRC" ]] || { echo "Missing $SRC" >&2; exit 3; }
MSGFILE=nginx/maintenance.message.json
esc=$(printf '%s' "$MESSAGE" | sed 's/"/\\"/g')
cat > "$MSGFILE.tmp" <<EOF
{
  "message": "$esc",
  "updatedAt": "$(date -u +%FT%TZ)"
}
EOF
mv "$MSGFILE.tmp" "$MSGFILE"
CID=$(docker ps --format '{{.Names}}' | grep -E '^watan-nginx$' || true)
if [[ -n "$CID" ]]; then
  # Overwrite active mode.conf directly so nginx uses it (no separate include needed)
  docker cp "$SRC" "$CID":/etc/nginx/conf.d/mode.conf
  docker cp "$MSGFILE" "$CID":/etc/nginx/conf.d/maintenance.message.json || true
  docker exec "$CID" nginx -t
  docker exec "$CID" nginx -s reload
  echo "[OK] maintenance switched $MODE"
else
  echo "[WARN] nginx container not found; copied locally only" >&2
fi
echo "Done." 
