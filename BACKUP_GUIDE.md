# Backup & Restore Guide

This guide describes how daily full and hourly wallets backups are produced, verified, and restored.

## 1. Overview
- Daily full database backup (all objects) at 03:15 server time.
- Hourly wallets snapshot (users + deposit tables) at minute 05 of every hour.
- Location: `/mnt/HC_Volume_103376794/backups`
- Retention:
  - Full: last 7 files kept (`full_YYYY-MM-DD.sql.gz`)
  - Wallets: last 48 files kept (`wallets_YYYY-MM-DD_HHMM.sql.gz`)

## 2. Scripts
| Script | Purpose |
|--------|---------|
| `scripts/backup_full.sh` | Full pg_dump gzip-compressed |
| `scripts/backup_wallets.sh` | Wallet-focused dump (users, deposit) |
| `scripts/backup-install.sh` | Installs cron entries & log setup |
| `scripts/verify_backups.sh` | Validates freshness + gzip integrity + schema restore test |

## 3. Cron (Installed by `backup-install.sh`)
```
15 3 * * *  root flock -n /tmp/wtn.backup.lock bash /root/watan/scripts/backup_full.sh >> /var/log/watan-backups.log 2>&1
5  * * * *  root flock -n /tmp/wtn.backup.lock bash /root/watan/scripts/backup_wallets.sh >> /var/log/watan-backups.log 2>&1
```
Lock file prevents overlapping runs.

## 4. Manual Execution
From server (root):
```
bash scripts/backup_full.sh
bash scripts/backup_wallets.sh
```

## 5. Verification
Run:
```
bash scripts/verify_backups.sh
```
Checks:
1. At least one `full_*.sql.gz` and one `wallets_*.sql.gz` exist.
2. Latest full age < 26h (configurable via `MAX_FULL_AGE_HOURS`).
3. Latest wallets age < 90m (configurable via `MAX_WALLETS_AGE_MIN`).
4. Gzip integrity (`gunzip -t`).
5. Schema-only partial restore into ephemeral DB (default: `watan_verify`).

Exit codes:
- 0 OK
- 1 Policy failure (missing / stale / restore error)
- 2 Unexpected script error

## 6. Configuration Overrides (Environment Variables)
| Var | Default | Description |
|-----|---------|-------------|
| `BACKUP_DIR` | `/mnt/HC_Volume_103376794/backups` | Backup storage path |
| `SERVICE` | `postgres` | Compose service hosting Postgres |
| `MAX_FULL_AGE_HOURS` | `26` | Max allowed age for the latest full backup |
| `MAX_WALLETS_AGE_MIN` | `90` | Max allowed age for latest wallets backup |
| `POSTGRES_TEST_DB` | `watan_verify` | Temp DB used for restore test |

## 7. Restore Procedure (Full Backup)
1. Pick desired file: `full_YYYY-MM-DD.sql.gz`.
2. Copy to server if external.
3. Stop application writers (maintenance mode / disable app containers touching DB).
4. Decompress & restore:
```
export PGPASSWORD="$POSTGRES_PASSWORD"
createdb -h 127.0.0.1 -U "$POSTGRES_USER" watan_restore || true
gunzip -c full_2025-09-12.sql.gz | psql -h 127.0.0.1 -U "$POSTGRES_USER" -d watan_restore
```
5. Validate critical tables row counts.
6. Swap (optional):
   - Point application to `watan_restore` or rename DBs (requires exclusive access).

## 8. Selective Wallets Restore
Used for forensic reconstruction:
```
export PGPASSWORD="$POSTGRES_PASSWORD"
createdb -h 127.0.0.1 -U "$POSTGRES_USER" wallets_tmp || true
gunzip -c wallets_2025-09-12_1405.sql.gz | psql -h 127.0.0.1 -U "$POSTGRES_USER" -d wallets_tmp
```

## 9. Periodic Audit Checklist
| Item | Target | Action if Fail |
|------|--------|----------------|
| Full backup age | < 24h | Investigate cron/logs, run manual full |
| Wallet backup age | < 60m (goal) | Check cron, DB load, disk space |
| Gzip integrity | PASS | Replace with latest good backup |
| Restore test | PASS | Escalate immediately |
| Free disk space | > 20% | Purge old / expand volume |

## 10. Hardening Ideas (Next)
- Encrypt backups at rest (gpg or S3 SSE if offloaded)
- Off-site replication (rsync / rclone to object storage)
- Point-in-time recovery (enable WAL archiving)
- Automated restore drill (monthly) + report

## 11. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| Backup file 0 bytes | pg_dump failed credentials | Check container env vars |
| Cron not running | service not loaded | `systemctl status cron` / reinstall script |
| Restore test slow | Large schema | Limit head lines or use `--schema-only` pg_dump mode |

## 12. Security Notes
- Limit server access; backups may contain PII.
- If offloading externally: use unique bucket + object lock (immutable). 
- Rotate Postgres credentials after suspected compromise.

---
Generated initial guide. Update after first successful external restore drill.
