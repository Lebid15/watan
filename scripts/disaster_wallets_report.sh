#!/usr/bin/env bash
# Disaster Recovery Wallets Report
# 1. Select wallets backup at specific timestamp (pref 11:05 UTC) or closest earlier.
# 2. Restore into temp DB.
# 3. Extract balances CSV (user_id,balance,currency,updated_at).

set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/mnt/HC_Volume_103376794/backups}
TARGET_HHMM=${TARGET_HHMM:-1105}        # Desired time (UTC) in HHMM
SERVICE=${SERVICE:-postgres}            # docker-compose service name
TMP_DB=${TMP_DB:-watan_dr_wallets}
OUTPUT=${OUTPUT:-wallet_balances.csv}
TABLE_USERS=${TABLE_USERS:-users}
TABLE_DEPOSIT=${TABLE_DEPOSIT:-deposit}
# Column names assumptions (adjust if schema differs)
USER_ID_COL=${USER_ID_COL:-id}
BALANCE_COL=${BALANCE_COL:-balance}
CURRENCY_COL=${CURRENCY_COL:-currency}
UPDATED_AT_COL=${UPDATED_AT_COL:-updated_at}

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: Backup dir not found: $BACKUP_DIR" >&2
  exit 2
fi

# Pick target date (today by default) override with DATE=YYYY-MM-DD
DATE=${DATE:-$(date -u +%Y-%m-%d)}
pattern="wallets_${DATE}_*.sql.gz"

candidates=$(ls -1 ${BACKUP_DIR}/${pattern} 2>/dev/null || true)
if [ -z "$candidates" ]; then
  echo "ERROR: No wallet backups for date $DATE" >&2
  exit 1
fi

# Extract HHMM from filenames and select closest <= TARGET_HHMM else earliest after.
selected_file=""
selected_delta=99999
selected_time=""
for f in $candidates; do
  base=$(basename "$f")
  hhmm=$(echo "$base" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/')
  [ -z "$hhmm" ] && continue
  if [ "$hhmm" -le "$TARGET_HHMM" ]; then
    delta=$(( TARGET_HHMM - hhmm ))
    if [ $delta -lt $selected_delta ]; then
      selected_delta=$delta
      selected_file=$f
      selected_time=$hhmm
    fi
  fi
done

# If none earlier/equal choose the earliest after target
if [ -z "$selected_file" ]; then
  earliest_after=$(ls -1 ${BACKUP_DIR}/${pattern} | sort | while read -r f; do
    base=$(basename "$f")
    hhmm=$(echo "$base" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/')
    if [ "$hhmm" -gt "$TARGET_HHMM" ]; then
      echo "$f"; break; fi; done)
  if [ -n "$earliest_after" ]; then
    selected_file=$earliest_after
    selected_time=$(basename "$earliest_after" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/')
  fi
fi

if [ -z "$selected_file" ]; then
  echo "ERROR: Could not select a backup file." >&2
  exit 1
fi

echo "[INFO] Selected wallets backup: $selected_file (time $selected_time UTC)"

# Drop & recreate temp DB
if docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname='${TMP_DB}'" | grep -q 1; then
  docker compose exec -T $SERVICE dropdb -U "$POSTGRES_USER" "$TMP_DB"
fi
docker compose exec -T $SERVICE createdb -U "$POSTGRES_USER" "$TMP_DB"

echo "[INFO] Restoring wallets backup into $TMP_DB ..."
gunzip -c "$selected_file" | docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" >/dev/null

echo "[INFO] Generating balances CSV -> $OUTPUT"
# Attempt a simple join or single table extraction depending on schema availability.
query="COPY (SELECT u.${USER_ID_COL} as user_id, u.${BALANCE_COL} as balance, u.${CURRENCY_COL} as currency, u.${UPDATED_AT_COL} as updated_at FROM ${TABLE_USERS} u ORDER BY u.${USER_ID_COL}) TO STDOUT WITH CSV HEADER"

docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" -c "$query" > "$OUTPUT"

ls -l "$OUTPUT"
echo "[DONE] Report ready: $OUTPUT (source time $selected_time UTC)"
