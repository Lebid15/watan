#!/usr/bin/env bash
set -euo pipefail

HOST=49.13.133.189
DIR=/root/watan

echo "==> Ensuring remote directory"
ssh root@${HOST} "mkdir -p ${DIR}" 

echo "==> Rsync project"
rsync -az --delete --exclude '.git' ./ root@${HOST}:${DIR}

echo "==> Writing .env (skip if exists)"
ssh root@${HOST} 'bash -s' <<'EOF'
set -e
cd /root/watan
if [ ! -f .env ]; then
cat > .env <<EOT
DATABASE_URL=postgres://user:pass@dbhost:5432/watan
REDIS_URL=redis://redishost:6379/0
JWT_SECRET=change-me-super-secret
PUBLIC_TENANT_BASE_DOMAIN=wtn4.com
AUTO_MIGRATIONS=true
HOST=0.0.0.0
PORT=3000
INITIAL_ROOT_EMAIL=owner@example.com
INITIAL_ROOT_PASSWORD=ChangeMe123!
BOOTSTRAP_ENABLED=true
NEXT_PUBLIC_API_URL=https://api.wtn4.com/api
EOT
else
echo ".env already exists; not overwriting"
fi
EOF

echo "==> Docker compose build & up"
ssh root@${HOST} "cd ${DIR} && docker compose config && docker compose build --pull && docker compose up -d"

echo "==> docker compose ps"
ssh root@${HOST} "cd ${DIR} && docker compose ps"

echo "==> Waiting for backend health"
for i in {1..25}; do
  if curl -fsS https://api.wtn4.com/api/health >/dev/null 2>&1; then
    echo "Backend healthy"
    break
  fi
  sleep 3
  if [ $i -eq 25 ]; then
    echo "Backend not healthy after timeout" >&2
  fi
done

echo "==> Frontend status line"
curl -I -s https://wtn4.com | head -n 1 || true

echo "==> Recent logs"
for svc in backend frontend worker nginx; do
  echo "--- $svc (last 40 lines) ---"
  ssh root@${HOST} "docker logs --tail=40 watan-$svc" || true
done
