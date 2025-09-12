# RESTORE GUIDE (Gold Release)

This document describes how to fully restore the production environment from a validated Gold release (e.g. `v1.0.0-gold`).

## 1. Prerequisites
- Access to container registry (e.g. GHCR) and permission to pull signed images.
- Access to gold artifacts directory stored externally (e.g. S3) containing:
  - `gold/<version>/backend/` SBOM + attestations
  - `gold/<version>/frontend/` SBOM + attestations
  - `gold/<version>/digests.txt`
  - `gold/<version>/data/` (full_*.sql.gz, wallets_*.sql.gz, wallet_balances.csv, wallet_balances.summary.txt, hashes.sha256, restore_test.log)
- Postgres server (same major version) ready & empty or with a disposable target DB name.
- `cosign` CLI installed for signature verification.
- `syft` (optional) for SBOM diffing.

## 2. Verify Image Integrity & Signatures
```bash
VERSION=v1.0.0-gold
OWNER=<your-gh-owner>
BACKEND_IMAGE=ghcr.io/$OWNER/watan-backend:$VERSION
FRONTEND_IMAGE=ghcr.io/$OWNER/watan-frontend:$VERSION

cosign verify $BACKEND_IMAGE
cosign verify $FRONTEND_IMAGE

# (Optional) fetch attestations (SBOM)
cosign verify-attestation --type cyclonedx $BACKEND_IMAGE | jq '.'
cosign verify-attestation --type cyclonedx $FRONTEND_IMAGE | jq '.'
```
Ensure the digest printed by `cosign` matches lines in `digests.txt`.

## 3. (Optional) SBOM Review / Diff
```bash
syft $BACKEND_IMAGE -o spdx-json > current-backend.spdx.json
# diff with stored sbom-backend-spdx.json
```

## 4. Restore Database
Decide whether to restore into the default database or a staging DB then swap.

### 4.1 Validate Backup Files
```bash
cd gold/$VERSION/data
sha256sum -c hashes.sha256
```
All lines must report `OK`.

### 4.2 Full Restore
Assuming environment variables:
- `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGPORT`, `PGDATABASE`

```bash
gunzip -c full_*.sql.gz | psql "$PGDATABASE"
```

### 4.3 (Optional) Apply Wallets Incremental (if needed)
If wallets backup captured newer user/deposit rows after the full backup (rare for same batch), apply selectively:
```bash
gunzip -c wallets_*.sql.gz | psql "$PGDATABASE"
```

### 4.4 Post-Restore Checks
```bash
psql -c "SELECT count(*) FROM public.users;"
psql -c "SELECT count(*) FROM public.deposit;"
```
Compare with `wallet_balances.summary.txt` & metadata in previous run logs.

## 5. Environment / Secrets
Re-create required environment variables (.env files, KMS keys, JWT secrets, third-party API keys). These are NOT stored inside the repository.

## 6. Run Migrations (If schema drift expected)
From backend directory:
```bash
npm ci --omit=dev
npm run migration:run   # adjust to actual command
```

## 7. Deploy Signed Images
Update your orchestration (docker compose / k8s manifests) to reference the immutable digests:
```bash
# example snippet
docker pull $BACKEND_IMAGE
BACKEND_DIGEST=$(docker inspect $BACKEND_IMAGE --format '{{index .RepoDigests 0}}')
```
Use digest pinning in compose/k8s:
```yaml
image: ghcr.io/OWNER/watan-backend@sha256:<digest>
```

## 8. Warm-Up / Smoke Tests
Execute k6 smoke test script or call readiness endpoints.
```bash
k6 run scripts/security/k6-login-smoke.js
```

## 9. Verification Checklist
- [ ] Image signatures verified
- [ ] Digests match `digests.txt`
- [ ] DB restored without errors
- [ ] Key tables row counts plausible
- [ ] Migrations applied (if needed)
- [ ] Smoke tests passed

## 10. Incident Rollback Strategy
Maintain previous gold version artifacts (`v0.x.x-gold`). If rollback needed:
1. Re-point deployment definitions to previous digests.
2. Restore previous full backup (retain current as separate snapshot for forensics).
3. Re-run smoke tests.

## 11. Branch Protection Guidance (Reference)
Refer to `docs/branch-protection.md` once created to ensure `main` is locked.

---
Prepared automatically during gold release process.
