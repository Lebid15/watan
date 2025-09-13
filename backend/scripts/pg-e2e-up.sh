#!/usr/bin/env bash
set -euo pipefail
docker rm -f pg-e2e >/dev/null 2>&1 || true
docker run -d --rm --name pg-e2e \
  -e POSTGRES_DB=watan_test \
  -e POSTGRES_USER=watan \
  -e POSTGRES_PASSWORD=pass \
  -p 54329:5432 postgres:16
