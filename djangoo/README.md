# djangoo (Django parity API)

Sidecar Django service under the prefix /api-dj/** to mirror selected NestJS endpoints without touching existing /api/**.

What’s in this batch
- Django + DRF + SimpleJWT + CORS + Jazzmin Admin + drf-spectacular
- PostgreSQL + Redis via .env
- Multi-tenant header: X-Tenant-Host
- Endpoints:
  - GET/PUT /api-dj/users/profile
  - GET /api-dj/users/profile-with-currency
  - Health /api-dj/health
  - Auth: /api-dj/auth/login, /api-dj/auth/refresh

## Run locally (Windows/PowerShell)
1) Copy .env.example to .env and adjust DB/Redis if needed.
2) Create venv and install deps:
```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt
```
3) Migrate and run:
```powershell
$env:DJANGO_SETTINGS_MODULE="config.settings"; python manage.py migrate; python manage.py runserver 0.0.0.0:8000
```
4) Admin (Jazzmin): http://localhost:8000/admin/ — create superuser:
```powershell
python manage.py createsuperuser
```

## Docker
- Build/run the Django sidecar from repo root (uses root compose):
```powershell
docker compose up -d djangoo
```
- Manual image build (if needed):
```powershell
docker build -t ghcr.io/OWNER/watan-djangoo:latest .
```

## Swagger
- Open /api-dj/docs for interactive docs (drf-spectacular).

## Auth
- JWT: POST /api-dj/auth/login with {"username","password"} returns access/refresh.
- Static API token: send header `api-token: <token>` or `X-API-Token: <token>`.

## Tenancy
- Send header `X-Tenant-Host: <tenant-host>`; middleware attaches request.tenant.

## Data strategy (phase 1)
- Connected to the same Postgres.
- To avoid collisions with existing Nest tables, this batch uses new tables: `dj_users`, `dj_tenants`.
- We’ll align to existing columns or add migration scripts later after review and approval.

## Notes & parity
- Responses aim to match Nest as closely as possible; if exact parity isn’t feasible, we’ll document and propose alternatives before any breaking change.
