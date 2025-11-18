# Local Backend (SQLite + Simplified Auth)

This document explains how to boot the minimal Go backend that talks to the real ZNet provider while storing state in SQLite and using a single demo login for convenience.

## 1. Prerequisites
- Go 1.22+
- Valid ZNet credentials (base URL, `kod`, `sifre`)

## 2. Configure Environment
1. Copy `.env.example` to `.env.local` (or `.env`).
2. Fill in the provider credentials and adjust the demo login if needed.

```bash
cp backend/.env.example backend/.env.local
```

### Important variables
| Variable | Description |
| --- | --- |
| `AHLA_APP_ADDR` | HTTP listen address (default `:8080`). |
| `AHLA_DATABASE_PATH` | SQLite file path. The folder is created automatically. |
| `AHLA_AUTH_DEMO_EMAIL/PASSWORD` | Hard-coded login accepted by `/api/v1/auth/login`. |
| `AHLA_AUTH_JWT_SECRET` | HMAC secret used to sign short-lived tokens. |
| `AHLA_AUTH_TENANT_ID` | Tenant id stored in SQLite and embedded inside issued tokens. |
| `AHLA_PROVIDER_ZNET_*` | Real provider settings pulled from `docs/znet.md`. |

## 3. Run the API
From `backend/`:

```bash
go run ./cmd/api
```

On startup the server:
1. Loads config from env.
2. Creates/opens the SQLite database.
3. Auto-migrates the minimal tables (tenant + provider credential snapshot).
4. Seeds/updates the tenant + provider data from env.
5. Exposes HTTP endpoints (see below).

## 4. Authentication Flow
1. `POST /api/v1/auth/login` with JSON body `{"email":"...","password":"..."}` matching the env values.
2. Receive `{ "token": "<jwt>" }`.
3. Send subsequent requests with `Authorization: Bearer <jwt>` header.

The middleware only checks signature/expiry and injects `tenant_id` into the Gin context—perfect for local smoke tests without wiring the full auth stack yet.

## 5. Provider Endpoints (real API calls)
| Endpoint | Method | Description |
| --- | --- | --- |
| `/healthz` | GET | Simple health probe. |
| `/api/v1/auth/login` | POST | Obtain demo token. |
| `/api/v1/provider-credentials` | GET | Lists the tenant's stored provider credentials (no secrets returned). |
| `/api/v1/provider-credentials` | POST | Creates a provider credential for the tenant (supports `znet`, `zdk`, `ahla`). |
| `/api/v1/providers/znet/balance?credential_id=<id>` | GET | Calls `bakiye_kontrol.php` using the specified credential (falls back to the latest one if omitted). |
| `/api/v1/providers/znet/products?credential_id=<id>` | GET | Calls `pin_listesi.php` using the selected credential. |
| `/api/v1/providers/znet/orders` | POST | Body now accepts `credential_id` alongside `game_id/coupon_id/player_identifier`; falls back to the latest credential if omitted. |
| `/api/v1/providers/zdk/balance?provider=barakat&credential_id=<id>` | GET | Fetches Barakat/APStore (ZDK-compatible) balance; `provider` defaults to `zdk` if omitted. |
| `/api/v1/providers/zdk/products?provider=barakat&credential_id=<id>` | GET | Lists products from the chosen ZDK-compatible credential. |
| `/api/v1/providers/zdk/orders` | POST | Submit `{ provider, credential_id, product_id, quantity, params }` to place a new ZDK-style order. |

> **Tip:** For ZDK-compatible providers (Barakat, APStore, Ahla) the `kod` field stores the API token; `sifre` can remain blank.

All provider requests resolve credentials from the database (seeded from env on first boot). Use the credential endpoints to add or rotate provider accounts per tenant without restarting the API. Failures bubble up as `502` responses with the upstream error string to simplify debugging.

## 6. Next Steps
- Expand the SQLite schema to include orders, products, and wallets per `database_schema.sql`.
- Add provider polling/cron jobs (e.g., order status checks, catalog sync).
- Replace demo auth with the proper tenant + end-user flows from the backend plan.
- Introduce structured logging/metrics and wrap ZNet calls with retries/circuit breakers.
