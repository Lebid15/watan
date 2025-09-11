#!/bin/sh
# Simple maintenance toggle.
# Usage: ./scripts/toggle-maintenance.sh on|off [message]
set -e
MODE=$1
MESSAGE=${2:-"يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء."}
if [ "$MODE" != "on" ] && [ "$MODE" != "off" ]; then
  echo "Usage: $0 on|off [message]" >&2; exit 1; fi
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT_DIR/nginx/mode.$MODE.conf"
DEST="$ROOT_DIR/nginx/mode.conf"
[ -f "$SRC" ] || { echo "Missing $SRC" >&2; exit 2; }
cp "$SRC" "$DEST"
printf '{"message":"%s","updatedAt":"%s"}\n' "$MESSAGE" "$(date -u +%FT%TZ)" > "$ROOT_DIR/nginx/maintenance.message.json"
echo "Switched maintenance $MODE"
if command -v docker >/dev/null 2>&1; then
  (cd "$ROOT_DIR" && docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload)
else
  echo "(docker not found – reload manually)"
fi
echo "Done." 
