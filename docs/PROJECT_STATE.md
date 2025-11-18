# Project State — 18 Nov 2025

## 1. Repository Snapshot
- **Repo / Branch**: `watan` @ `feature/superadmin-backend`
- **Primary Goal**: deliver a production-ready super-admin experience (tenant CRUD, catalog management, settings) backed by the Go API.
- **Key Apps**:
  - `backend/` — Go API + Postgres + Redis.
  - `frontend/superadmin/` — Next.js 16 dashboard (primary focus).
  - `frontend/agents-app/`, `frontend/tenants` etc. exist but are not active in this effort.

## 2. What’s Already Done
- **Backend**
  - `/api/v1/superadmin` endpoints for auth, tenants, categories, products confirmed from earlier manual tests.
  - Compose exposes `api` (Go server), shared Postgres (`db`), and Redis (`redis`).

- **Superadmin Frontend** (`frontend/superadmin`)
  - Auth flow wired to the real API (token storage, profile fetch, logout enforcement in `app/layoutClient.tsx`).
  - `lib/superadminApi.ts` centralizes axios calls for login/profile + tenants/products/categories, including error helpers.
  - Tenant dashboard (`app/subdomains/page.tsx`) rebuilt: debounced search, status filter, stats cards, modal-driven create/update hooked to live endpoints.
  - Settings > Security wrapper now imports `app/security/page.tsx` (new file) to satisfy dynamic import requirements.
  - `fmtDateStable` helper added under `lib/` and all pages adjusted accordingly to keep builds green.

- **Environment / Tooling**
  - `npm install` completed inside `frontend/superadmin` (uses Node 20 runtime; local dev box still on Node 18, but Docker images run with Node 20).
  - `backend/docker-compose.yml` extended with a `superadmin` service (builds from `../frontend/superadmin`, listens on 3003, depends on `api`). Caddy service is configured to depend on it when the prod profile is used.
  - Compose build+run verified: `sudo docker compose build superadmin` & `sudo docker compose up api superadmin -d` succeed (containers currently running locally).

## 3. Current Status
- Dashboard is accessible at `http://localhost:3003` (from the host running docker compose) and authenticates against the live API.
- Tenants page functions end-to-end (list, create, edit). Other areas like catalog/products, providers, stats, etc. still rely on stub data and fail lint/type checks.
- ESLint pass still fails because many legacy files use `any` or missing dependencies. This does not block builds (handled via Docker) but needs cleanup before merging upstream.

## 4. Outstanding / Next Steps
1. **Assess dashboard scope** — audit remaining screens and confirm requirements for catalog CRUD, settings, stats, provider management.
2. **Plan implementation** — prioritize roadmap, set data-fetching patterns (e.g., SWR/tanStack) and shared UI components.
3. **Implement catalog + other modules** — replace stub data with `superadminApi.products/categories`, add CRUD modals, validation, and tests.
4. **Polish + QA** — resolve ESLint/TS errors, add tests, tighten auth guard flows, and document env variables for production deploys.

Reference the root todo list (managed beside this file) for live tracking of these items.

## 5. Active Docker Services
_All defined in `backend/docker-compose.yml` (run from `backend/`)._

| Service      | Image/Build                                | Ports (host→container) | Depends On                 | Purpose |
|--------------|--------------------------------------------|------------------------|----------------------------|---------|
| `api`        | Build: `backend/Dockerfile` (Go API)       | `8080:8080`            | `db` (healthy), `redis`    | Super-admin REST API + core backend. |
| `agents`     | Build: `frontend/agents-app/Dockerfile`    | `3000:3000`            | `api`                      | Agents-facing Next.js app (not currently in active use but kept for parity). |
| `superadmin` | Build: `frontend/superadmin/Dockerfile`    | `3003:3003`            | `api`                      | Super-admin dashboard (primary UI). |
| `caddy`      | `caddy:2.8-alpine` (prod profile only)     | `80:80`, `443:443`     | `api`, `agents`, `superadmin` | Reverse proxy / TLS termination; configure `Caddyfile` to expose dashboards publicly. |
| `db`         | `postgres:15`                              | `5432:5432`            | —                          | Main Postgres database (`ahla` schema). |
| `redis`      | `redis:7-alpine`                           | _not published_        | —                          | Caching + background coordination for backend. |

_Notes_
- Compose env files: backend uses `.env.compose` (or override via `BACKEND_ENV_FILE`), agents uses `../frontend/agents-app/.env.compose`, superadmin uses `../frontend/superadmin/.env.compose` (sets `NEXT_PUBLIC_SUPERADMIN_API_URL=http://api:8080/api/v1/superadmin`).
- When exposing superadmin publicly, either run `caddy` or map host port 3003 and handle TLS elsewhere.

## 6. Quick Commands
```bash
# Build everything (run from backend/)
sudo docker compose build

# Start API + superadmin locally
sudo docker compose up api superadmin -d

# Tail logs if needed
sudo docker compose logs -f superadmin

# Stop and clean up
sudo docker compose down
```

## 7. Known Risks / Watch Items
- **Node version mismatch**: local dev machine is on Node 18. Next.js 16 warns unless run through Docker or upgraded to >=20.9 via nvm.
- **Lint debt**: numerous files (catalog, providers, stats) still have `any` and missing deps, preventing `npm run lint` success. Plan remediation before merging to main.
- **Security page**: currently just wraps the older implementation; confirm requirements before further edits.
- **Auth secrets**: `.env.compose` files hold Auth0 IDs and should be reviewed for production readiness.

This document should be updated whenever major milestones land (new dashboards, infra changes, etc.) so future contributors/agents can resume without digging through history.
