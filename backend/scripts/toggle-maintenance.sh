#!/usr/bin/env bash
# (Enforced LF via .gitattributes; avoid CRLF to prevent /usr/bin/env^M issues on alpine)
set -euo pipefail

NGINX_NAME=${NGINX_CONTAINER_NAME:-watan-nginx}
MODE=${1:-}
MESSAGE=${2:-"يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء."}

if [[ -z "$MODE" || ! "$MODE" =~ ^(on|off)$ ]]; then
  echo "Usage: $0 <on|off> [message]" >&2; exit 2;
fi

# Shared bind-mounted directory from host (see docker-compose: ./nginx -> /opt/nginx-shared)
SHARED_DIR=/opt/nginx-shared
MODE_FILE="$SHARED_DIR/mode.conf"
HTML_FILE="$SHARED_DIR/maintenance.html"
MSG_FILE="$SHARED_DIR/maintenance.message.json"

if [[ ! -d "$SHARED_DIR" ]]; then
  echo "Shared dir $SHARED_DIR missing (check docker-compose volume)" >&2; exit 5;
fi

# Generate new mode.conf atomically
tmp_mode=$(mktemp "$SHARED_DIR/.mode.conf.XXXXXX")
{
  echo "# runtime override generated $(date -u +%FT%TZ)";
  if [[ "$MODE" == on ]]; then
    echo "set \$maintenance_switch on;"
  else
    echo "set \$maintenance_switch off;"
  fi
} > "$tmp_mode"
mv -f "$tmp_mode" "$MODE_FILE"

# Prepare message JSON (atomic)
esc_json=$(printf '%s' "$MESSAGE" | sed 's/"/\\"/g')
tmp_msg=$(mktemp "$SHARED_DIR/.maintenance.message.json.XXXXXX")
cat > "$tmp_msg" <<EOF
{
  "message": "$esc_json",
  "updatedAt": "$(date -u +%FT%TZ)"
}
EOF
mv -f "$tmp_msg" "$MSG_FILE"

# Prepare maintenance HTML (atomic)
html_msg=$(printf '%s' "$MESSAGE" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/&#39;/g" -e ':a;N;$!ba;s/\n/<br>\n/g')
updated_iso=$(date -u +%FT%TZ)
tmp_html=$(mktemp "$SHARED_DIR/.maintenance.html.XXXXXX")
cat > "$tmp_html" <<EOF
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>الصيانة قيد التنفيذ</title><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem}.card{max-width:640px;background:#1e293b;padding:2rem 2.25rem;border:1px solid #334155;border-radius:14px;box-shadow:0 6px 18px -4px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.35)}h1{margin-top:0;font-size:1.9rem;letter-spacing:.5px}p{line-height:1.6;font-size:1.05rem}.msg{margin:1.25rem 0 0;font-weight:500}.time{margin-top:1.75rem;font-size:.7rem;opacity:.65;direction:ltr;text-align:left}</style>
</head><body><div class="card"><h1>🚧 الموقع في وضع الصيانة</h1><p class="msg">$html_msg</p><p class="time">Updated: $updated_iso UTC</p></div></body></html>
EOF
mv -f "$tmp_html" "$HTML_FILE"

# Validate and reload nginx
if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not available in container" >&2; exit 3;
fi
if ! docker ps --format '{{.Names}}' | grep -q "^${NGINX_NAME}$"; then
  echo "nginx container '$NGINX_NAME' not found" >&2; exit 4;
fi

if ! docker exec "$NGINX_NAME" nginx -t; then
  echo "nginx config test failed" >&2; exit 6;
fi
docker exec "$NGINX_NAME" nginx -s reload

echo "[OK] maintenance switched $MODE"
