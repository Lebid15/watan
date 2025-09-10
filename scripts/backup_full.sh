#!/usr/bin/env bash
set -euo pipefail

# Config
COMPOSE_DIR="/root/watan"
BACKUP_DIR="/mnt/HC_Volume_103376794/backups"
SERVICE="postgres"

cd "$COMPOSE_DIR"
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F)
OUTFILE="$BACKUP_DIR/full_${STAMP}.sql.gz"

# Run pg_dump inside the postgres container; use container env vars for credentials
# Note: we set PGPASSWORD from POSTGRES_PASSWORD so pg_dump won’t prompt.
docker compose exec -T "$SERVICE" bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 > "$OUTFILE"

# Keep last 7 files, delete older
# shellcheck disable=SC2012
ls -tp "$BACKUP_DIR"/full_*.sql.gz 2>/dev/null | grep -v '/$' | tail -n +8 | xargs -r rm --

echo "[backup_full] Wrote $OUTFILE"
