#!/usr/bin/env bash
set -euo pipefail
# Simple ffuf content discovery wrapper.
# Usage: BASE=https://api.wtn4.com WORDLIST=wordlist.txt ./scripts/security/ffuf_discovery.sh

: "${BASE:?Set BASE, e.g. BASE=https://api.wtn4.com}";
WORDLIST=${WORDLIST:-/usr/share/seclists/Discovery/Web-Content/common.txt}

echo "[INFO] Running ffuf against $BASE with $WORDLIST"
ffuf -u "$BASE/FUZZ" -w "$WORDLIST" -mc all -fc 404 -t 20 -of json -o ffuf-results.json || true
echo "[INFO] Output saved to ffuf-results.json"
