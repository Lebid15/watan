$ErrorActionPreference = "Stop"

# Remove old container if exists
$existing = docker ps -aq -f "name=pg-e2e"
if ($existing) { docker rm -f pg-e2e | Out-Null }

# Start ephemeral Postgres
ocker run -d --rm --name pg-e2e `
  -e POSTGRES_DB=watan_test `
  -e POSTGRES_USER=watan `
  -e POSTGRES_PASSWORD=pass `
  -p 54329:5432 postgres:16 | Out-Null

# Wait until ready
$max=40; $i=0
while ($i -lt $max) {
  $log = docker logs pg-e2e --since 1s 2>$null
  if ($log -match "database system is ready to accept connections") { break }
  Start-Sleep -Seconds 1
  $i++
}
