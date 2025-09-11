#!/usr/bin/env bash
set -euo pipefail
# Toggle global maintenance mode (Nginx) + optional Cloudflare purge.
# Usage:
#   ./scripts/toggle-maintenance-with-purge.sh on  "رسالة صيانة اختيارية"
#   ./scripts/toggle-maintenance-with-purge.sh off
#   ./scripts/toggle-maintenance-with-purge.sh status
# Env (optional for purge):
#   CF_API_TOKEN   - Cloudflare API token with Zone.CachePurge permission
#   CF_ZONE_ID     - Cloudflare Zone ID
#   NO_PURGE=1     - Skip purge even if token present
#   DOCKER_NGINX=watan-nginx (override container name)
#
# Exits non‑zero on failure.

MODE_FILE="nginx/mode.conf"
MSG_FILE="nginx/maintenance.message.json"
CONTAINER=${DOCKER_NGINX:-watan-nginx}
ACTION=${1:-status}
MESSAGE=${2:-}

red()  { printf "\033[31m%s\033[0m\n" "$*"; }
grn()  { printf "\033[32m%s\033[0m\n" "$*"; }
yel()  { printf "\033[33m%s\033[0m\n" "$*"; }
blu()  { printf "\033[34m%s\033[0m\n" "$*"; }

require_container() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    red "Container ${CONTAINER} not running"; exit 1; fi
}

show_status() {
  local current="unknown"
  if grep -q 'set \$maintenance_switch on' "$MODE_FILE" 2>/dev/null; then current=on; fi
  if grep -q 'set \$maintenance_switch off' "$MODE_FILE" 2>/dev/null; then current=off; fi
  grn "Current maintenance: ${current}"
  if command -v curl >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
      local hdr
      hdr=$(curl -s -I https://wtn4.com/ | grep -i '^x-maint-mode:' || true)
      [ -n "$hdr" ] && blu "Origin header: $hdr"
    fi
  fi
}

write_mode() {
  local new=$1
  printf '## Snippet included inside each server block (auto)
set $maintenance_switch %s;\n' "$new" > "$MODE_FILE"
  grn "Updated ${MODE_FILE} => $new"
}

write_message() {
  local msg=$1
  [ -z "$msg" ] && return 0
  jq -nc --arg m "$msg" --arg t "$(date -u +%FT%TZ)" '{message:$m,updated_at:$t}' > "$MSG_FILE" 2>/dev/null \
    || printf '{"message":"%s","updated_at":"%s"}\n' "$msg" "$(date -u +%FT%TZ)" > "$MSG_FILE"
  grn "Updated ${MSG_FILE}"
}

reload_nginx() {
  require_container
  docker exec "$CONTAINER" nginx -t >/dev/null
  docker exec "$CONTAINER" nginx -s reload
  grn "Reloaded Nginx (${CONTAINER})"
}

purge_cloudflare() {
  [ "${NO_PURGE:-0}" = "1" ] && { yel "Skip purge (NO_PURGE=1)"; return 0; }
  if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
    yel "Purging Cloudflare cache ..."
    local resp code
    resp=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" -H 'Content-Type: application/json' \
      --data '{"purge_everything":true}') || true
    echo "$resp" | grep -q '"success":true' && grn "Cloudflare purge success" || red "Cloudflare purge MAY have failed"; echo "$resp" | grep -E 'errors|messages' || true
  else
    yel "Cloudflare purge skipped (missing CF_API_TOKEN / CF_ZONE_ID)"
  fi
}

case "$ACTION" in
  status)
    show_status; exit 0 ;;
  on|enable)
    write_mode on
    write_message "$MESSAGE"
    reload_nginx
    purge_cloudflare
    show_status
    ;;
  off|disable)
    write_mode off
    write_message "$MESSAGE"
    reload_nginx
    purge_cloudflare
    show_status
    ;;
  *)
    red "Unknown action: $ACTION"; echo "Usage: $0 [on|off|status] [optional-message]"; exit 2 ;;
esac
