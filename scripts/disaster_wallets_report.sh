#!/usr/bin/env bash
# Disaster Recovery Wallets Report
# 1. Select wallets backup at specific timestamp (pref 11:05 UTC) or closest earlier.
# 2. Restore into temp DB.
# 3. Extract balances CSV (user_id,balance,currency,updated_at).

set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/mnt/HC_Volume_103376794/backups}
TARGET_HHMM=${TARGET_HHMM:-1105}        # Desired time (UTC) in HHMM (numeric compare forced base10)
SERVICE=${SERVICE:-postgres}            # docker-compose service name
TMP_DB=${TMP_DB:-watan_dr_wallets}
OUTPUT=${OUTPUT:-wallet_balances.csv}
TABLE_USERS=${TABLE_USERS:-users}
TABLE_DEPOSIT=${TABLE_DEPOSIT:-deposit}
# Column names assumptions (adjust if schema differs)
USER_ID_COL=${USER_ID_COL:-id}
BALANCE_COL=${BALANCE_COL:-balance}
# Default currency column often currency_id; fall back from currency -> currency_id -> literal 'N/A'
CURRENCY_COL=${CURRENCY_COL:-currency}
UPDATED_AT_COL=${UPDATED_AT_COL:-updated_at}

# Produce a human-friendly summary from the generated CSV (if present)
produce_summary() {
  local csv="$1"
  local summary_file="${csv%.csv}.summary.txt"
  [ ! -s "$csv" ] && return 0
  awk -F',' 'NR==1{next} {rows++; bal=$2; gsub(/\r/,"",bal); if(bal==""||bal=="\\N") bal=0; sum+=bal; if(min==""||bal<min){min=bal; minUser=$1} if(max==""||bal>max){max=bal; maxUser=$1} if($3=="N/A"||$3=="\\N") unkCur++ ; if($3 ~ /^[0-9a-fA-F-]{36}$/) uuidCur++ ; if($2!="0" && $2!="0.00" && $2!="0.0") activeUsers++ } END { 
    if(rows==0){exit 0}
    printf "Wallet Balances Summary\n";
    printf "Generated: %s UTC\n", strftime("%Y-%m-%d %H:%M:%S", systime());
    sbt=ENVIRON["selected_time"]; if(sbt=="") sbt="UNKNOWN"; printf "Source Backup Time: %s UTC\n", sbt;
    printf "Users (rows): %d\n", rows;
    printf "Active (non-zero) users: %d\n", activeUsers;
    printf "Total Balance: %.2f\n", sum;
    printf "Average Balance: %.2f\n", (rows? sum/rows:0);
    printf "Max Balance: %.2f (user_id=%s)\n", max, maxUser;
    printf "Min Balance: %.2f (user_id=%s)\n", min, minUser;
    printf "Unknown / Null currency rows: %d\n", unkCur;
    if(uuidCur>0) printf "Currency values that look like UUIDs (likely currency_id pending lookup): %d\n", uuidCur;
  }' selected_time="$selected_time" "$csv" > "$summary_file" 2>/dev/null || true
  if [ -s "$summary_file" ]; then
    echo "[INFO] Summary written: $summary_file" >&2
  fi
}

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: Backup dir not found: $BACKUP_DIR" >&2
  exit 2
fi

# Auto-detect Postgres credentials from container if not exported on host
if [ -z "${POSTGRES_USER:-}" ]; then
  POSTGRES_USER=$(docker compose exec -T "$SERVICE" bash -lc 'echo -n "$POSTGRES_USER"' 2>/dev/null || echo postgres)
fi
if [ -z "${POSTGRES_DB:-}" ]; then
  POSTGRES_DB=$(docker compose exec -T "$SERVICE" bash -lc 'echo -n "$POSTGRES_DB"' 2>/dev/null || echo "$POSTGRES_USER")
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
if [ "${TARGET_HHMM,,}" = "latest" ]; then
  # Simply pick the lexicographically last (newest) file
  selected_file=$(ls -1 ${BACKUP_DIR}/${pattern} | sort | tail -n1)
  selected_time=$(basename "$selected_file" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/')
else
  for f in $candidates; do
    base=$(basename "$f")
    hhmm=$(echo "$base" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/')
    [ -z "$hhmm" ] && continue
    # Force base 10 to avoid octal interpretation of leading zero times (e.g. 0805)
    if (( 10#$hhmm <= 10#$TARGET_HHMM )); then
      delta=$(( 10#$TARGET_HHMM - 10#$hhmm ))
      if (( delta < selected_delta )); then
        selected_delta=$delta
        selected_file=$f
        selected_time=$hhmm
      fi
    fi
  done
fi

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

# Fallback derive time if still empty
if [ -z "$selected_time" ]; then
  selected_time=$(basename "$selected_file" | sed -E 's/^wallets_[0-9]{4}-[0-9]{2}-[0-9]{2}_([0-9]{4})\.sql\.gz$/\1/') || true
fi

echo "[INFO] Selected wallets backup: $selected_file (time $selected_time UTC)"

# Drop & recreate temp DB
if docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname='${TMP_DB}'" >/dev/null 2>&1; then
  docker compose exec -T $SERVICE dropdb -U "$POSTGRES_USER" "$TMP_DB" || true
fi
docker compose exec -T $SERVICE createdb -U "$POSTGRES_USER" "$TMP_DB"

echo "[INFO] Restoring wallets backup into $TMP_DB ..."
if ! gunzip -c "$selected_file" | docker compose exec -T $SERVICE psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d "$TMP_DB" >/dev/null 2>&1; then
  echo "[WARN] Restore reported errors (likely missing dependent types); continuing to attempt users table extraction." >&2
fi

echo "[INFO] Generating balances CSV -> $OUTPUT"
## Detect correct currency column (currency -> currency_id -> literal)
currency_detect=$(docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='${TABLE_USERS}' AND column_name IN ('currency','currency_id') ORDER BY 1 LIMIT 1;" 2>/dev/null | tr -d '[:space:]') || true
if [ -n "$currency_detect" ]; then
  CURRENCY_COL="$currency_detect"
else
  CURRENCY_COL="" # will use literal
fi

if [ -n "$CURRENCY_COL" ]; then
  select_currency="u.${CURRENCY_COL} as currency"
else
  select_currency="'N/A'::text as currency"
fi

# Verify users table exists; if not attempt raw extraction from dump
if ! docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='${TABLE_USERS}';" | grep -q 1; then
  echo "[WARN] users table not found after restore – falling back to direct dump parsing." >&2
  tmp_tsv=$(mktemp)
  gunzip -c "$selected_file" | awk "/^COPY ${TABLE_USERS} /,/^\\\\.$/" > "$tmp_tsv" || true
  if grep -q '^COPY' "$tmp_tsv"; then
    # Remove first (COPY ...) line and last line containing single dot
    sed '1d;$d' "$tmp_tsv" | awk -F'\t' '{print $1","$2","$3","$4}' | {
      echo "user_id,balance,currency,updated_at"; cat -; } > "$OUTPUT"
    rm -f "$tmp_tsv"
    ls -l "$OUTPUT"
    echo "[DONE] Report ready (dump parsing mode): $OUTPUT (source time $selected_time UTC)"
    produce_summary "$OUTPUT"
    exit 0
  else
    echo "[FAIL] Could not parse users data from dump." >&2
    exit 1
  fi
fi

query="COPY (SELECT u.${USER_ID_COL} as user_id, u.${BALANCE_COL} as balance, ${select_currency}, u.${UPDATED_AT_COL} as updated_at FROM ${TABLE_USERS} u ORDER BY u.${USER_ID_COL}) TO STDOUT WITH CSV HEADER"

if ! docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" -c "$query" > "$OUTPUT" 2>/dev/null; then
  echo "[WARN] Query failed – attempting minimal column subset (id,balance,updated_at)." >&2
  fallback_query="COPY (SELECT u.${USER_ID_COL} as user_id, u.${BALANCE_COL} as balance, u.${UPDATED_AT_COL} as updated_at FROM ${TABLE_USERS} u ORDER BY u.${USER_ID_COL}) TO STDOUT WITH CSV HEADER"
  if docker compose exec -T $SERVICE psql -U "$POSTGRES_USER" -d "$TMP_DB" -c "$fallback_query" > "$OUTPUT.tmp" 2>/dev/null; then
    { IFS= read -r header; echo "${header%,updated_at},currency,updated_at"; awk -F',' 'NR>1{print $1","$2",N/A,"$3}' "$OUTPUT.tmp"; } > "$OUTPUT" || true
    rm -f "$OUTPUT.tmp"
    ls -l "$OUTPUT"
    echo "[DONE] Report ready (fallback query): $OUTPUT (source time $selected_time UTC)"
    produce_summary "$OUTPUT"
    exit 0
  else
    echo "[WARN] Both SQL extraction paths failed – switching to raw dump parsing." >&2
    # Raw dump parsing: derive column positions from COPY line and output mapped CSV
    gunzip -c "$selected_file" | awk -v userIdPref="${USER_ID_COL}" -v balPref="${BALANCE_COL}" -v currPref="${CURRENCY_COL}" -v updPref="${UPDATED_AT_COL}" '
      BEGIN{copy=0; haveHeader=0}
      /^COPY public\.users / {
        line=$0
        sub(/^COPY public.users \(/,"",line)
        sub(/\) FROM stdin;.*/,"",line)
        gsub(/ /,"",line)
        n=split(line, cols, ",")
        for(i=1;i<=n;i++){pos[cols[i]]=i}
        # Determine balance column
        bal=balPref; if(!(bal in pos)){candidates[1]="balance";candidates[2]="wallet_balance";candidates[3]="current_balance";candidates[4]="amount";candidates[5]="total_balance"; for(ci=1;ci<=5;ci++){ if(candidates[ci] in pos){ bal=candidates[ci]; break } }}
        # Determine currency column
        curr=""; if(currPref!="" && currPref in pos){curr=currPref} else if("currency" in pos){curr="currency"} else if("currency_id" in pos){curr="currency_id"}
        # Determine updated_at column
        upd=updPref; if(!(upd in pos)){alts[1]="updated_at";alts[2]="updatedAt";alts[3]="modified_at";alts[4]="created_at"; for(ai=1;ai<=4;ai++){ if(alts[ai] in pos){ upd=alts[ai]; break } }}
        # Determine id column
        uid=userIdPref; if(!(uid in pos)){ if("id" in pos){uid="id"} }
        # Store chosen names
        chosen_id=uid; chosen_bal=bal; chosen_curr=curr; chosen_upd=upd;
        print "user_id,balance,currency,updated_at"; haveHeader=1; copy=1; next
      }
      copy && /^\\\.$/ {exit}
      copy {
        nfs=split($0,f,"\t")
        id = (chosen_id in pos)? f[pos[chosen_id]]:""
        balance = (chosen_bal in pos)? f[pos[chosen_bal]]:"0"
        currency = (chosen_curr!="" && chosen_curr in pos)? f[pos[chosen_curr]]:"N/A"
        updated = (chosen_upd in pos)? f[pos[chosen_upd]]:""
        print id "," balance "," currency "," updated
      }
    ' > "$OUTPUT" || true
    if [ -s "$OUTPUT" ]; then
      ls -l "$OUTPUT"
      echo "[DONE] Report ready (raw dump parsing): $OUTPUT (source time $selected_time UTC)"
      produce_summary "$OUTPUT"
      exit 0
    else
      echo "[FAIL] Raw dump parsing produced empty output." >&2
      exit 1
    fi
  fi
else
  ls -l "$OUTPUT"
  echo "[DONE] Report ready: $OUTPUT (source time $selected_time UTC)"
  produce_summary "$OUTPUT"
fi
