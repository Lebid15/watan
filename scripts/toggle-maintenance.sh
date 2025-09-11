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

# --- Generate dynamic maintenance.html (served as 503 page) ---
# We overwrite the repo file nginx/maintenance.html (bind-mounted read-only into container, host change propagates).
HTML_FILE="nginx/maintenance.html"
# Basic HTML escaping (& < > ' ") and newline to <br>.
html_msg=$(printf '%s' "$MESSAGE" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/&#39;/g" -e ':a;N;$!ba;s/\n/<br>\n/g')
updated_iso=$(date -u +%FT%TZ)
cat > "$HTML_FILE.tmp" <<EOF
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>الصيانة قيد التنفيذ</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1.5rem; }
    .card { max-width:640px; background:#1e293b; padding:2rem 2.25rem; border:1px solid #334155; border-radius:14px; box-shadow:0 6px 18px -4px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.35); }
    h1 { margin-top:0; font-size:1.9rem; letter-spacing:.5px; }
    p { line-height:1.6; font-size:1.05rem; }
    .msg { margin:1.25rem 0 0; font-weight:500; }
    .time { margin-top:1.75rem; font-size:.75rem; opacity:.7; direction:ltr; text-align:left; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚧 الموقع في وضع الصيانة</h1>
    <p class="msg">$html_msg</p>
    <p class="time">Updated: $updated_iso UTC</p>
  </div>
</body>
</html>
EOF
mv "$HTML_FILE.tmp" "$HTML_FILE"
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
