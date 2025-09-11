#!/usr/bin/env bash
set -euo pipefail
MODE=${1:-}
MESSAGE=${2:-"يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء."}
if [[ -z "$MODE" || ! "$MODE" =~ ^(on|off)$ ]]; then
  echo "Usage: $0 <on|off> [message]" >&2; exit 2;
fi
# Generate temporary mode.conf content
TMP_MODE=$(mktemp)
if [[ "$MODE" == "on" ]]; then
  cat > "$TMP_MODE" <<EOF
# runtime override generated
map "on" $maintenance_mode { default on; }
EOF
else
  cat > "$TMP_MODE" <<EOF
# runtime override generated
map "off" $maintenance_mode { default off; }
EOF
fi
# Prepare message JSON
esc_json=$(printf '%s' "$MESSAGE" | sed 's/"/\\"/g')
TMP_MSG=$(mktemp)
cat > "$TMP_MSG" <<EOF
{
  "message": "$esc_json",
  "updatedAt": "$(date -u +%FT%TZ)"
}
EOF
# Prepare maintenance HTML
TMP_HTML=$(mktemp)
html_msg=$(printf '%s' "$MESSAGE" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/&#39;/g" -e ':a;N;$!ba;s/\n/<br>\n/g')
updated_iso=$(date -u +%FT%TZ)
cat > "$TMP_HTML" <<EOF
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>الصيانة قيد التنفيذ</title><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem}.card{max-width:640px;background:#1e293b;padding:2rem 2.25rem;border:1px solid #334155;border-radius:14px;box-shadow:0 6px 18px -4px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.35)}h1{margin-top:0;font-size:1.9rem;letter-spacing:.5px}p{line-height:1.6;font-size:1.05rem}.msg{margin:1.25rem 0 0;font-weight:500}.time{margin-top:1.75rem;font-size:.7rem;opacity:.65;direction:ltr;text-align:left}</style>
</head><body><div class="card"><h1>🚧 الموقع في وضع الصيانة</h1><p class="msg">$html_msg</p><p class="time">Updated: $updated_iso UTC</p></div></body></html>
EOF
# Ensure docker CLI present
if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not available in container" >&2; exit 3;
fi
NGINX_CID=$(docker ps --format '{{.Names}}' | grep -E '^watan-nginx$' || true)
if [[ -z "$NGINX_CID" ]]; then
  echo "nginx container not found" >&2; exit 4;
fi
# Copy artifacts
docker cp "$TMP_MODE" "$NGINX_CID":/etc/nginx/conf.d/mode.conf
docker cp "$TMP_MSG"  "$NGINX_CID":/etc/nginx/conf.d/maintenance.message.json || true
docker cp "$TMP_HTML" "$NGINX_CID":/usr/share/nginx/html/maintenance.html || true
# Test & reload
docker exec "$NGINX_CID" nginx -t
docker exec "$NGINX_CID" nginx -s reload
rm -f "$TMP_MODE" "$TMP_MSG" "$TMP_HTML"
echo "[OK] maintenance switched $MODE"
