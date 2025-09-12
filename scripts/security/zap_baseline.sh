#!/usr/bin/env bash
set -euo pipefail
# Convenience wrapper for OWASP ZAP baseline scan (docker).
# Usage: TARGET=https://staging.wtn4.com ./scripts/security/zap_baseline.sh

: "${TARGET:?Set TARGET env var, e.g. TARGET=https://staging.wtn4.com}";
RULES_FILE=".zap-rules"
if [ ! -f "$RULES_FILE" ]; then
  cat > "$RULES_FILE" <<'EOF'
# Example ZAP rules file
10054 IGNORE # Cookie without SameSite
10063 IGNORE # CSP not set (will fix later)
EOF
fi

docker run --rm -v "$(pwd)":/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py \
  -t "$TARGET" -a -J zap-report.json -w zap-warn.txt -r zap-report.html -c $RULES_FILE || true

echo "[INFO] Reports generated: zap-report.json, zap-report.html (if HTML enabled)"
