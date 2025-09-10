#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="/root/watan"
BACKUP_DIR="/mnt/HC_Volume_103376794/backups"
SERVICE="postgres"

cd "$COMPOSE_DIR"
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F_%H%M)
OUTFILE="$BACKUP_DIR/wallets_${STAMP}.sql.gz"

# Dump only users and deposit tables
docker compose exec -T "$SERVICE" bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -t users -t deposit "$POSTGRES_DB"' | gzip -9 > "$OUTFILE"

# Keep last 48 files
# shellcheck disable=SC2012
ls -tp "$BACKUP_DIR"/wallets_*.sql.gz 2>/dev/null | grep -v '/$' | tail -n +49 | xargs -r rm --

echo "[backup_wallets] Wrote $OUTFILE"
