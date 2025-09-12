#!/usr/bin/env bash
set -euo pipefail
# Wrapper around gitleaks to use repo config if present.

CONFIG=""
if [ -f .gitleaks.toml ]; then
  CONFIG="-c .gitleaks.toml"
fi

echo "[INFO] Running gitleaks (workspace scan)"
gitleaks detect --no-git -s . $CONFIG --redact || {
  STATUS=$?
  echo "[WARN] gitleaks exited with code $STATUS (findings or error). Continue for aggregation." >&2
  exit 0
}
