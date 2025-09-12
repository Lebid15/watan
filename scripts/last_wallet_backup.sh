#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/mnt/HC_Volume_103376794/backups}
MAX_MINUTES=${MAX_MINUTES:-60}
PATTERN="wallets_*.sql.gz"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: Backup directory not found: $BACKUP_DIR" >&2
  exit 2
fi

latest_file=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$PATTERN" -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | awk '{print $2}')

if [ -z "${latest_file:-}" ]; then
  echo "No wallets backups found." >&2
  exit 1
fi

# File modification epoch seconds
file_epoch=$(stat -c %Y "$latest_file")
now_epoch=$(date +%s)
age_sec=$(( now_epoch - file_epoch ))
age_min=$(( age_sec / 60 ))

# Human readable timestamp
file_ts=$(date -d @"$file_epoch" '+%Y-%m-%d %H:%M:%S %Z')

if [ $age_min -le $MAX_MINUTES ]; then
  echo "LATEST_WALLETS_BACKUP=$latest_file"
  echo "TIMESTAMP=$file_ts"
  echo "AGE_MINUTES=$age_min"
  exit 0
else
  echo "WARNING: Latest wallets backup is older than $MAX_MINUTES minutes" >&2
  echo "LATEST_WALLETS_BACKUP=$latest_file"
  echo "TIMESTAMP=$file_ts"
  echo "AGE_MINUTES=$age_min"
  exit 1
fi
