#!/bin/bash
# Simple health check script. Logs only on failure or state change.
# Location suggestion: /root/watan/scripts/health-check.sh

URL="https://api.wtn4.com/api/health"
STATE_FILE="/root/watan/health.state"
TS=$(date '+%Y-%m-%d %H:%M:%S')

# Perform request with 5s timeout
HTTP_CODE=$(curl -k -m 5 -s -o /dev/null -w '%{http_code}' "$URL" || echo "000")

PREV="UNKNOWN"
[ -f "$STATE_FILE" ] && PREV=$(cat "$STATE_FILE")

if [ "$HTTP_CODE" = "200" ]; then
  CURR="UP"
else
  CURR="DOWN($HTTP_CODE)"
fi

if [ "$CURR" != "$PREV" ]; then
  echo "$TS | state-change | $PREV -> $CURR" 
  echo "$CURR" > "$STATE_FILE"
  # Optional: hook for email / webhook can be added here
else
  # Log only failures even without change
  if [[ "$CURR" == DOWN* ]]; then
    echo "$TS | fail | still $CURR"
  fi
fi
