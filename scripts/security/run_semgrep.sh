#!/usr/bin/env bash
set -euo pipefail
# Wrapper to run semgrep with local custom rules plus 'auto'
# Usage: ./scripts/security/run_semgrep.sh [path]

TARGET_DIR="${1:-.}"

CONFIG_ARGS=(--config auto)
if [ -f scripts/security/semgrep-rules.yml ]; then
  CONFIG_ARGS+=(--config scripts/security/semgrep-rules.yml)
fi

echo "[INFO] Running semgrep on $TARGET_DIR with configs: ${CONFIG_ARGS[*]}"
semgrep --error --max-target-bytes 2000000 "${CONFIG_ARGS[@]}" --timeout 120 --metrics=off --exclude-dir node_modules "$TARGET_DIR"
