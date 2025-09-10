param(
  [Parameter(Mandatory=$true)][ValidateSet('on','off')] [string]$mode,
  [string]$message = 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.'
)

$server = '49.13.133.189'

# One-liner: set env MAINTENANCE, pull, recreate nginx, and reload
$remoteCmd = @"
set -e
cd ~/watan
# export variable for compose
export MAINTENANCE=$mode
# ensure nginx sees updated include files
git pull --rebase
# recreate only nginx with new env
MAINTENANCE=$mode docker compose up -d --no-deps --build nginx
# graceful reload (optional, container recreated already)
docker compose exec -T nginx nginx -s reload || true
"@

ssh root@$server $remoteCmd
