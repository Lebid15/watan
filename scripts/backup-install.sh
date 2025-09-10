#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="/root/watan"
CRON_FILE="/etc/cron.d/watan-backups"
LOG_FILE="/var/log/watan-backups.log"

cd "$COMPOSE_DIR"

# Ensure scripts are executable
chmod +x scripts/*.sh

# Write cron spec
cat > "$CRON_FILE" <<'CRON'
# watan backups
# daily full at 03:15
15 3 * * * root flock -n /tmp/wtn.backup.lock bash /root/watan/scripts/backup_full.sh >> /var/log/watan-backups.log 2>&1
# hourly wallets at minute 5
5 * * * * root flock -n /tmp/wtn.backup.lock bash /root/watan/scripts/backup_wallets.sh >> /var/log/watan-backups.log 2>&1
CRON

chmod 644 "$CRON_FILE"

# Ensure log file exists
touch "$LOG_FILE"
chmod 664 "$LOG_FILE" || true

# Reload cron service
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload cron || systemctl restart cron || true
else
  service cron reload || service cron restart || true
fi

echo "[backup-install] Installed cron to $CRON_FILE and reloaded cron"
