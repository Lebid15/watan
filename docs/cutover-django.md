# Cutover plan: Django sidecar under /api-dj/**

This guide describes a safe, phased rollout of the Django sidecar while keeping the existing NestJS API at /api/** intact. It includes validation, Nginx config, CI, monitoring, and rollback steps.

## Goals
- Serve Django at /api-dj/** on api.wtn4.com alongside NestJS at /api/**
- Keep multi-tenancy through X-Tenant-Host header
- Enforce JWT for internal endpoints and api_token for external intake
- Provide Swagger at /api-dj/docs and health at /api-dj/health
- Zero-downtime rollout with straightforward rollback

## Prerequisites
- Docker services running: postgres, redis, backend (NestJS), frontend, nginx, djangoo
- Database populated and Django unmanaged models aligned with existing schema
- Env configured in `djangoo/.env` (see `.env.example`)

## Nginx wiring
- Upstream `djangoo_upstream` and new location block are added in `nginx/nginx.conf`:
  - `location ^~ /api-dj/ { proxy_pass http://djangoo_upstream; ... }`
  - Pass headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
  - Forward `X-Tenant-Host` when present
  - Reflect `Origin` to support CORS

No change to /api/**; both APIs co-exist.

## CI
- Workflow `.github/workflows/django-ci.yml` runs on pushes/PRs:
  - Installs Python deps from `djangoo/requirements.txt`
  - Copies `.env.example` to `.env` with CI-safe overrides
  - Runs `python manage.py check --deploy`
  - Validates OpenAPI schema generation with drf-spectacular

## Phased rollout
1) Pre-flight checks
   - Confirm containers: `docker compose ps`
   - Health:
     - `GET https://api.wtn4.com/api-dj/health` with `X-Tenant-Host: <tenant>.wtn4.com`
     - `GET https://api.wtn4.com/api/health` still 200 from Nest
   - Docs: `GET https://api.wtn4.com/api-dj/docs`

2) Admin readiness
   - Sign in to obtain JWT via existing flow (or create a token user)
   - Validate RBAC-protected endpoints:
     - Providers coverage: `GET /api-dj/admin/providers/coverage`
     - Import catalog dry-run: `POST /api-dj/admin/providers/integrations/{id}/import-catalog`
     - Apply mappings: `POST ...?apply=true`
     - Apply costs: `POST ...?applyCosts=true&currency=USD`

3) External adapter smoke
   - Create/update znet integration credentials
   - `PATCH /api-dj/admin/orders/{id}/sync-external` (admin only)
   - `POST /api-dj/admin/orders/{id}/refresh-external` to fetch status
   - Verify provider messages and pin capture on completion

4) Poller (optional initial manual)
   - Run mgmt: `python manage.py poll_external_orders --limit 20`
   - Confirm updates, then decide on scheduling (see below)

## Scheduling the poller
Pick one:
- Cron inside the djangoo container
  - Add a lightweight cron + wrapper script
- Celery Beat
  - Introduce Celery + Redis, schedule task for polling
- External scheduler
  - e.g., systemd timer, Kubernetes CronJob, or Windows Task Scheduler

Start with a manual run and observe; schedule only after confidence.

## Monitoring & logs
- Nginx access/error logs under `nginx_logs`
- Django RequestLogMiddleware prints per-request lines with method, path, tenantId, userId, status, durationMs
- Add provider-side logs for external calls if needed (requests logging can be toggled)

## Rollback
- Nginx has no changes to /api/**; to disable sidecar quickly:
  - Scale down the djangoo service: `docker compose stop djangoo`
  - Or temporarily remove the /api-dj/ location block and reload Nginx
- Data changes are idempotent and unmanaged models avoid migrations

## Troubleshooting
- 403/401
  - Ensure JWT in Authorization header or api_token for external routes
  - Confirm RBAC role is developer, instance_owner, or distributor (or superuser)
- 400 tenant
  - Add `X-Tenant-Host: <tenant>.wtn4.com` or `localhost` in local
- CORS
  - Origin must match allowed pattern for `api.wtn4.com`; we reflect Origin selectively. For tests, use curl with proper Origin header or test via frontend.
- Provider errors
  - Check returned message from znet, adapter logs, and network reachability

## Production runbook (summary)
- Merge CI green changes
- Deploy stack (compose up -d)
- Verify health/docs under /api-dj/
- Enable admin sync-external on a subset of orders
- If stable, schedule poller at modest cadence (e.g., every 2-5 minutes)
- Monitor logs and error rates; adjust thresholds and timeouts as needed
