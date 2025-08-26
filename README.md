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

### Production Image / Upload Notes

Cloudinary credentials must live only in the root `.env` (loaded via `env_file:` in `docker-compose.yml`). Do NOT repeat `CLOUDINARY_*` inside `services.backend.environment` or Docker will override them with empty values. Example `.env` snippet:

```
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=123456
CLOUDINARY_API_SECRET=redacted
CLOUDINARY_URL=cloudinary://123456:redacted@your_cloud
```

Nginx is the canonical CORS layer for `/api/*` and hides upstream headers; leave backend CORS disabled (commented out) to avoid duplicates.

If using Cloudflare and the origin has NO IPv6, remove AAAA records for `api.<domain>` or Cloudflare may return intermittent `521` (origin down) for uploads while IPv4 works. Keep only the A record until you enable IPv6 on the VPS.

Deployment checklist:

1. `git pull`
2. `docker compose build --no-cache backend frontend`
3. `docker compose up -d --force-recreate backend frontend nginx`
4. Health: `curl https://api.example.com/nginx-healthz` → `ok`
5. Auth: `curl -X POST https://api.example.com/api/auth/login` (get token)
6. Upload test:
	```bash
	curl -H "Authorization: Bearer $TOKEN" -F file=@test.png https://api.example.com/api/admin/upload
	```
7. Catalog image propagation:
	```bash
	curl -H "Authorization: Bearer $TOKEN" \
		  -H "Content-Type: application/json" \
		  -H "X-Tenant-Id: <tenant-id>" \
		  -d '{"imageUrl":"<secure_url>","propagate":true}' \
		  https://api.example.com/api/admin/catalog/products/<product-id>/image
	```

Expected responses:
* Upload: `201 { url, secure_url }`
* Patch image (missing product): `404 Catalog product not found`
* Patch with propagate but no tenant header: `400` explaining tenantId missing
* Oversize file: `400 { code: file_too_large }`
* Bad Cloudinary creds: `401 { code: cloudinary_bad_credentials }`
* Generic upstream Cloudinary issue: `5xx { code: upload_failed }`

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