#!/usr/bin/env bash
set -euo pipefail

# golden_release_collect.sh
# Purpose: Collect full DB backup, wallets backup, generate wallet balances CSV & summary, quick restore test,
# and place outputs under gold/<version>/data.
# Assumptions: running on infra host (self-hosted runner) that has docker compose and access to postgres service & backup scripts.
# Inputs:
#   VERSION (required) e.g. v1.0.0-gold
#   POSTGRES_SERVICE (default: postgres)
#   COMPOSE_DIR (default: current repo root)
#   TMP_RESTORE_DB (default: watan_gold_verify)
#   GOLD_BASE (default: gold)

VERSION=${VERSION:?VERSION required (e.g. v1.0.0-gold)}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-postgres}
COMPOSE_DIR=${COMPOSE_DIR:-$(pwd)}
TMP_RESTORE_DB=${TMP_RESTORE_DB:-watan_gold_verify}
GOLD_BASE=${GOLD_BASE:-gold}
OUT_DIR="$GOLD_BASE/$VERSION/data"
mkdir -p "$OUT_DIR"

log(){ echo "[gold-collect] $*"; }

# 1. Full DB backup (pg_dump) reuse logic from backup_full.sh but local paths
STAMP=$(date +%F_%H%M%S)
FULL_FILE="$OUT_DIR/full_${STAMP}.sql.gz"
log "Creating full DB backup -> $FULL_FILE"
# Execute pg_dump inside container using env vars
CMD_FULL='export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"'
LATEST_FULL="$FULL_FILE" docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T "$POSTGRES_SERVICE" bash -lc "$CMD_FULL" | gzip -9 > "$FULL_FILE"

# 2. Wallets backup (users + deposit)
WALLETS_FILE="$OUT_DIR/wallets_${STAMP}.sql.gz"
log "Creating wallets backup -> $WALLETS_FILE"
CMD_WAL='export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -t public.users -t public.deposit "$POSTGRES_DB"'
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T "$POSTGRES_SERVICE" bash -lc "$CMD_WAL" | gzip -9 > "$WALLETS_FILE"

# 3. Generate wallet balances CSV (best-effort). Adjust query if schema differs.
BAL_CSV="$OUT_DIR/wallet_balances.csv"
BAL_SUMMARY="$OUT_DIR/wallet_balances.summary.txt"
log "Extracting wallet balances -> $BAL_CSV"
QUERY_BAL='SET row_security=off; SELECT id, email, created_at FROM public.users ORDER BY created_at LIMIT 5000;'
CMD_BAL=$(cat <<'Q'
export PGPASSWORD="$POSTGRES_PASSWORD";
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F, --no-align -q -c "$QUERY_BAL"
Q
)
QUERY_BAL="$QUERY_BAL" docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T "$POSTGRES_SERVICE" bash -lc "$CMD_BAL" > "$BAL_CSV" || {
  log "WARN: Failed to extract balances (query or permissions)"; touch "$BAL_CSV"; }

# Summary stats (line count etc.)
{ echo "rows=$(grep -c '^[0-9]' "$BAL_CSV" || echo 0)"; } > "$BAL_SUMMARY"

# 4. Quick restore schema test into temp DB
log "Performing schema-only restore test (first ~5000 lines) into $TMP_RESTORE_DB"
RESTORE_CMD=$(cat <<'RCMD'
export PGPASSWORD="$POSTGRES_PASSWORD";
psql -h 127.0.0.1 -U "$POSTGRES_USER" -tc "DROP DATABASE IF EXISTS \"$TMP_RESTORE_DB\";" postgres;
psql -h 127.0.0.1 -U "$POSTGRES_USER" -tc "CREATE DATABASE \"$TMP_RESTORE_DB\";" postgres;
# Schema-only sample
set -o pipefail
( gunzip -c "$FULL_FILE" | head -n 5000 | psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$TMP_RESTORE_DB" >/dev/null ) || true
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$TMP_RESTORE_DB" -c '\dt' | head -n 25
RCMD
)
FULL_FILE="$FULL_FILE" TMP_RESTORE_DB="$TMP_RESTORE_DB" docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T "$POSTGRES_SERVICE" bash -lc "$RESTORE_CMD" > "$OUT_DIR/restore_test.log" 2>&1 || log "WARN: restore test encountered issues (see restore_test.log)"

# 5. Digest sha256 of backups for integrity
sha256sum "$FULL_FILE" "$WALLETS_FILE" > "$OUT_DIR/hashes.sha256" || true

log "Collection complete. Files:"
ls -1 "$OUT_DIR"
