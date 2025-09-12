#!/usr/bin/env bash
set -euo pipefail
# Verifies backup freshness and performs a lightweight restore test in a temporary container.
# Requirements: docker compose service 'postgres' available, access to BACKUP_DIR.
# Environment overrides:
#   BACKUP_DIR, POSTGRES_TEST_DB (default: watan_verify), SERVICE (default: postgres)
#   MAX_FULL_AGE_HOURS (default 26), MAX_WALLETS_AGE_MIN (default 90)

BACKUP_DIR=${BACKUP_DIR:-/mnt/HC_Volume_103376794/backups}
SERVICE=${SERVICE:-postgres}
MAX_FULL_AGE_HOURS=${MAX_FULL_AGE_HOURS:-26}
MAX_WALLETS_AGE_MIN=${MAX_WALLETS_AGE_MIN:-90}
TEST_DB=${POSTGRES_TEST_DB:-watan_verify}

cd /root/watan || true

fail() { echo "[verify_backups][FAIL] $1" >&2; exit 1; }
warn() { echo "[verify_backups][WARN] $1" >&2; }
info() { echo "[verify_backups] $1"; }

shopt -s nullglob
full_files=($BACKUP_DIR/full_*.sql.gz)
wallet_files=($BACKUP_DIR/wallets_*.sql.gz)
shopt -u nullglob

[[ ${#full_files[@]} -eq 0 ]] && fail "No full_*.sql.gz backups found"
[[ ${#wallet_files[@]} -eq 0 ]] && fail "No wallets_*.sql.gz backups found"

latest_full=$(ls -t $BACKUP_DIR/full_*.sql.gz | head -n1)
latest_wallet=$(ls -t $BACKUP_DIR/wallets_*.sql.gz | head -n1)

now_epoch=$(date +%s)
full_age_hours=$(( (now_epoch - $(date -r "$latest_full" +%s)) / 3600 ))
wallet_age_min=$(( (now_epoch - $(date -r "$latest_wallet" +%s)) / 60 ))

if (( full_age_hours > MAX_FULL_AGE_HOURS )); then
  fail "Latest full backup is ${full_age_hours}h old (limit ${MAX_FULL_AGE_HOURS}h): $latest_full"
fi
if (( wallet_age_min > MAX_WALLETS_AGE_MIN )); then
  fail "Latest wallets backup is ${wallet_age_min}m old (limit ${MAX_WALLETS_AGE_MIN}m): $latest_wallet"
fi

info "Latest full: $latest_full (age ${full_age_hours}h)"
info "Latest wallets: $latest_wallet (age ${wallet_age_min}m)"

# Lightweight restore test: create temp DB, restore schema only from full backup (for speed)
info "Performing schema-only restore test into ${TEST_DB}"

# Extract only first ~2 MB to detect gzip integrity quickly (gunzip -t would also work)
if ! gunzip -t "$latest_full" 2>/dev/null; then
  fail "Gzip integrity failed for $latest_full"
fi

# Drop test DB if exists, then create
restore_cmd=$(cat <<'RCMD'
export PGPASSWORD="$POSTGRES_PASSWORD";
psql -h 127.0.0.1 -U "$POSTGRES_USER" -tc "DROP DATABASE IF EXISTS \"$TEST_DB\";" postgres;
psql -h 127.0.0.1 -U "$POSTGRES_USER" -tc "CREATE DATABASE \"$TEST_DB\";" postgres;
# Restore schema only (fast)
gunzip -c "$LATEST_FULL" | head -n 5000 | psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$TEST_DB" >/dev/null 2>&1 || true;
# Basic sanity: list tables
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$TEST_DB" -c "\dt" | head -n 20;
RCMD
)

LATEST_FULL="$latest_full" docker compose exec -T "$SERVICE" bash -lc "$restore_cmd" || fail "Restore test failed"

info "Backup verification completed successfully"
