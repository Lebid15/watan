#!/usr/bin/env bash
# Wrapper so running from repo root works (user previously tried path without scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/scripts/disaster_wallets_report.sh" "$@"
