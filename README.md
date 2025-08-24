## Local Development (Database & Redis)

Use `docker-compose.dev.yml` to spin up Postgres + Redis (and optionally backend) with known credentials:

```bash
docker compose -f docker-compose.dev.yml up -d db redis

# Or include backend (hot reload via volume mount):
docker compose -f docker-compose.dev.yml up -d
```

Environment settings baked into this dev stack:
- Postgres: postgres/postgres, DB: watan
- Redis: port 6379
- Backend dev URL: http://localhost:3000

If you prefer to run backend outside Docker, keep the services up and set in `backend/.env.local`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/watan
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=local-dev-secret
PUBLIC_TENANT_BASE_DOMAIN=localhost
```

Then from `backend/`:
```bash
npm run start:dev
```

To stop and remove dev containers:
```bash
docker compose -f docker-compose.dev.yml down
```

To reset Postgres data:
```bash
docker compose -f docker-compose.dev.yml down -v
```

Production deployment uses the main `docker-compose.yml` (without local DB/Redis). Add external DATABASE_URL & REDIS_URL in the root `.env` for GitHub Actions or VPS deploy.

## Fast Remote Deployment

Helper scripts in `scripts/` for quicker backend-focused deploys without waiting for CI.

### Bash (Linux/macOS/WSL)
Script: `scripts/remote-fast-deploy.sh`

Features:
- Select services (default: backend)
- Skip migrations (`NO_MIGRATIONS=1`)
- Skip build (`NO_BUILD=1`)
- Auto skip backend build if unchanged (`AUTO_SKIP_UNCHANGED=1`)
- Stores last successful commit in `.deploy/last_success`

Examples:
```bash
# Standard fast deploy
bash scripts/remote-fast-deploy.sh

# Include worker
SERVICES="backend worker" bash scripts/remote-fast-deploy.sh

# Skip migrations
NO_MIGRATIONS=1 bash scripts/remote-fast-deploy.sh

# Skip build
NO_BUILD=1 bash scripts/remote-fast-deploy.sh

# Auto skip build when unchanged
AUTO_SKIP_UNCHANGED=1 bash scripts/remote-fast-deploy.sh
```

### PowerShell (Windows)
Script: `scripts/remote-fast-deploy.ps1`
```powershell
pwsh -File scripts/remote-fast-deploy.ps1
$env:NO_BUILD=1; $env:NO_MIGRATIONS=1; pwsh -File scripts/remote-fast-deploy.ps1
$env:AUTO_SKIP_UNCHANGED=1; pwsh -File scripts/remote-fast-deploy.ps1
```

Defaults: SSH host alias `syr1-vps` (override with `SSH_TARGET`), remote dir `/root/watan` (override with `REMOTE_DIR`).