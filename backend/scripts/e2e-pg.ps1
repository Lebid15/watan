$ErrorActionPreference = "Stop"

try {
  & "$PSScriptRoot/pg-e2e-up.ps1"

  # Env for this run
  $env:NODE_ENV = "test"
  $env:TEST_DB_SQLITE = "false"
  if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgres://watan:pass@127.0.0.1:54329/watan_test"
  }
  $env:TYPEORM_MIGRATIONS_RUN = "true"

  npx jest test/e2e/orders.unit.e2e-spec.ts --runInBand
  $code = $LASTEXITCODE
}
finally {
  & "$PSScriptRoot/pg-e2e-down.ps1"
}

exit $code
