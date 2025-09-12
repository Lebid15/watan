#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="/root/watan"
BACKUP_DIR="/mnt/HC_Volume_103376794/backups"
SERVICE="postgres"

cd "$COMPOSE_DIR"
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F_%H%M)
OUTFILE="$BACKUP_DIR/wallets_${STAMP}.sql.gz"
METAFILE="$BACKUP_DIR/wallets_${STAMP}.meta"

# Pre-flight: count rows (attempt to bypass RLS for diagnostic only)
# Use -q (quiet) to suppress command tags like SET, then extract first pure numeric line.
USER_COUNT=$(docker compose exec -T "$SERVICE" bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -qAt -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SET row_security=off; SELECT count(*) FROM public.users;" 2>/dev/null' | awk ' /^[0-9]+$/ {print; exit}' || true)
DEPOSIT_COUNT=$(docker compose exec -T "$SERVICE" bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -qAt -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SET row_security=off; SELECT count(*) FROM public.deposit;" 2>/dev/null' | awk ' /^[0-9]+$/ {print; exit}' || true)
[ -z "$USER_COUNT" ] && USER_COUNT="?"
[ -z "$DEPOSIT_COUNT" ] && DEPOSIT_COUNT="?"

# Dump only users and deposit tables (include data + schema)
docker compose exec -T "$SERVICE" bash -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -t public.users -t public.deposit "$POSTGRES_DB"' | gzip -9 > "$OUTFILE"

# Post-flight: detect if users COPY section has rows when count suggested >0
# (previous awk one-liner broke on some awk variants due to missing separator)
COPY_ROWS=$(gunzip -c "$OUTFILE" | awk '
	/^COPY public\.users / { in_section=1; next }
	/^\\\.$/ { in_section=0 }
	in_section { c++ }
	END { print c+0 }
' 2>/dev/null || echo 0)

WARN_MSG=""
if [ "$USER_COUNT" != "?" ] && [ "$USER_COUNT" -gt 0 ] && [ "$COPY_ROWS" -eq 0 ]; then
	WARN_MSG="users table had $USER_COUNT rows but dump captured 0 rows. Possible RLS or insufficient privileges for dumping user data. Ensure dump role owns the table or has BYPASSRLS / is superuser."
fi

{
	echo "timestamp=$STAMP";
	echo "users_rowcount_db=$USER_COUNT";
	echo "deposit_rowcount_db=$DEPOSIT_COUNT";
	echo "users_rows_in_dump=$COPY_ROWS";
	if [ -n "$WARN_MSG" ]; then echo "warning=$WARN_MSG"; fi
} > "$METAFILE"

# Keep last 48 files
# shellcheck disable=SC2012
ls -tp "$BACKUP_DIR"/wallets_*.sql.gz 2>/dev/null | grep -v '/$' | tail -n +49 | xargs -r rm --

if [ -n "$WARN_MSG" ]; then
	echo "[backup_wallets][WARN] $WARN_MSG" >&2
fi
echo "[backup_wallets] Wrote $OUTFILE (users_rows_in_dump=$COPY_ROWS, users_db=$USER_COUNT, deposit_db=$DEPOSIT_COUNT)"
echo "[backup_wallets] Metadata: $METAFILE"
