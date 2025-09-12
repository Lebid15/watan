# External Artifacts Upload

Artifacts for a Gold release are staged locally under `gold/<version>/`. To push them to external read-only storage (e.g., S3), follow one of the methods below.

## Layout
```
gold/
  v1.0.0-gold/
    backend/
      sbom-backend.json
      sbom-backend-spdx.json
    frontend/
      sbom-frontend.json
      sbom-frontend-spdx.json
    digests.txt
    GOLD_BUILD_REPORT.md
    data/ (if infra collection executed)
      full_<timestamp>.sql.gz
      wallets_<timestamp>.sql.gz
      wallet_balances.csv
      wallet_balances.summary.txt
      hashes.sha256
      restore_test.log
```

## S3 Upload (Manual)
```bash
VERSION=v1.0.0-gold
BUCKET=my-gold-artifacts-bucket
aws s3 cp --recursive gold/$VERSION s3://$BUCKET/$VERSION/
```
Set bucket policy to read-only for consumers if public distribution is intended.

## Azure Blob
```bash
VERSION=v1.0.0-gold
CONTAINER=gold
az storage blob upload-batch -d $CONTAINER/$VERSION -s gold/$VERSION
```

## GCS
```bash
VERSION=v1.0.0-gold
BUCKET=my-gold-artifacts
gsutil -m cp -r gold/$VERSION gs://$BUCKET/
```

## Integrity Verification After Upload
Download and verify hashes:
```bash
aws s3 cp s3://$BUCKET/$VERSION/data/hashes.sha256 /tmp/hashes.sha256
# sync or fetch the data directory locally first
grep full_ /tmp/hashes.sha256 | sha256sum -c -
```

## Immutability Recommendation
- Enable Object Lock / Versioning (S3) where feasible.
- Use separate IAM role for read-only consumers (e.g. auditors).

## Automation Hook
A future workflow step can conditionally perform the upload if credentials are provided securely via GitHub Secrets:
- `AWS_S3_GOLD_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

The current workflow contains an optional placeholder to integrate this logic (disabled until secrets are added securely).
