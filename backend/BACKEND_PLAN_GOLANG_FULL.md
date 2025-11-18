# Ahla Backend Plan (Go Edition · Consolidated)

> This document merges Part 1 (structure, stack, DB, models), Part 2 (API, auth, tenancy, providers), and Part 3 (workers, testing, deployment, roadmap) into a single reference while keeping the original files for traceability.

## Table of Contents
1. Scope & Principles
2. Repository & Project Structure
3. Technology Stack & Tooling
4. Database Strategy (PostgreSQL + SQLite) & Migrations
5. Core Domain Models (32 tables)
6. API Surface & Routing Strategy
7. Authentication & Authorization
8. Multi-Tenancy Middleware & Rate Limiting
9. Provider Integrations (ZNet, ZDK)
10. DTOs, Validation, Observability
11. Background Workers & Async Jobs
12. Notification Channels
13. Testing Strategy & QA Automation
14. Docker, Compose, & Deployment Targets
15. Development Phases, Milestones, Risks
16. Immediate Next Actions

---

## 1. Scope & Principles
- Multi-tenant gaming reseller platform (MySQL schema already ported to PostgreSQL for production, SQLite for local).
- Requirements: high throughput order pipeline, flexible pricing, provider integrations, strict tenant isolation, auditability.
- Architectural values: opinionated module boundaries (`cmd/`, `internal/`, `pkg/`), dependency injection-friendly services, minimized global state.

---

## 2. Repository & Project Structure
```
backend/
├── go.mod / go.sum
├── cmd/
│   ├── api/            # REST API executable
│   ├── worker/         # Background worker + scheduler
│   └── cli/            # Admin utilities (migrate, seed, dlq)
├── internal/
│   ├── config/
│   ├── logging/
│   ├── database/
│   │   ├── migrator/
│   │   ├── postgres/
│   │   └── sqlite/
│   ├── middleware/
│   ├── domain/
│   │   ├── models.go
│   │   ├── repositories/
│   │   └── services/
│   ├── transport/
│   │   ├── http/
│   │   └── dto/
│   ├── providers/
│   ├── workflows/
│   └── workers/
├── pkg/                # Shared helpers (crypto, notify)
├── migrations/
├── seeds/
├── tests/              # e2e suites (k6/Postman)
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```
**Conventions:** singular package names, `_test.go` neighbors, generated files inside `internal/generated/`, DTO naming `order_create_request.go`.

---

## 3. Technology Stack & Tooling
| Layer | Tool | Reason |
| --- | --- | --- |
| HTTP | `github.com/gin-gonic/gin` | Mature, performant, ecosystem-rich |
| OR/M | `gorm.io/gorm` + raw SQL | Fast prototyping, struct tags align with schema |
| DB Driver | `github.com/jackc/pgx/v5` (Postgres), `modernc.org/sqlite` (SQLite) | Feature-rich & CGO-free |
| Migrations | `github.com/golang-migrate/migrate/v4` | Works with both drivers |
| Config | `github.com/spf13/viper` | Env-first, profile aware |
| Logging | `go.uber.org/zap` | Structured JSON logs |
| Validation | `github.com/go-playground/validator/v10` | Standard for Gin |
| Background Jobs | `github.com/hibiken/asynq` (Redis) | Reliable task queue |
| Rate Limiting | `github.com/ulule/limiter/v3` | Token bucket w/ Redis backend |
| Decimal Math | `github.com/shopspring/decimal` | Precise money math |
| UUIDs | `github.com/google/uuid` | Standard type |
| Password Hash | `github.com/alexedwards/argon2id` | Secure defaults |
| MFA | `github.com/pquerna/otp/totp` | TOTP generation/verification |
| JWT | `github.com/lestrrat-go/jwx/v2` | EdDSA/RS256 support |
| HTTP Client | `github.com/go-resty/resty/v2` | Retries, logging |
| Testing | `github.com/stretchr/testify`, `github.com/DATA-DOG/go-sqlmock`, `github.com/ory/dockertest/v3` | Assertions + DB mocks + containerized integration |
| Docs | `github.com/swaggo/swag` | Swagger/OpenAPI generation |
| Linting | `github.com/golangci/golangci-lint/cmd/golangci-lint`, `github.com/securego/gosec/v2` | CI quality gate |
| Observability | `go.opentelemetry.io/contrib/.../otelgin`, `github.com/prometheus/client_golang/prometheus/promhttp` | Tracing + metrics |

---

## 4. Database Strategy & Migrations
| Env | Engine | Location | Command |
| --- | --- | --- | --- |
| Dev | SQLite (`./tmp/AHLA_dev.db`) | Local | `make migrate-dev` |
| Test | SQLite in-memory | CI | `go test ./... -tags=sqlite_test` |
| Staging | PostgreSQL 15 | Managed | `make migrate-staging` |
| Prod | PostgreSQL 15+ | Managed | `make migrate-prod` |

**Connection pools:** `pgxpool` with tuned `MaxConns`, `MinConns`, `MaxConnLifetime`. SQLite opened with WAL mode for concurrency.

**Migrations:** timestamped SQL files; CLI wrappers `make migrate-new name=create_orders`. Seeds limited to non-production via CLI commands.

**Indexing:** Rent indexes for hot paths; future Postgres partitioning for `orders`, `transactions`, `audit_logs` by tenant + month.

---

## 5. Core Domain Models (32 Tables)
`internal/domain/models.go` houses struct definitions mirroring schema. (Abbreviated excerpt; full list identical to Part 1.)
```go
package domain

import (
    "database/sql/driver"
    "time"

    "github.com/google/uuid"
    "github.com/shopspring/decimal"
)

type JSONB map[string]any
func (j JSONB) Value() (driver.Value, error) { /* marshal */ }
func (j *JSONB) Scan(value interface{}) error { /* unmarshal */ }

// SuperAdmin, Tenant, TenantUser, EndUser, PriceTier, ProductCategory, Product,
// TenantProduct, Provider, ProviderCredential, ProviderProduct, UserProviderProduct,
// Currency, TenantExchangeRate, ExchangeRateChange, ProductTierPrice, Order,
// OrderNote, OrderFulfillment, CodeInventory, Wallet, Transaction, PaymentRail,
// Announcement, Instruction, StaticPage, AuditLog, InstructionAttachment,
// ProviderWebhookLog, SettlementRequest, NotificationPreference, APIToken.
```
> See original Part1 for the full struct block; the generated Go file should be treated as the single source of truth and exported for openapi generation/tests.

**Key Domain Rules (synced with DB summary):**
- End users inherit both price tiers and exchange rates from their tenant; they cannot self-select tiers or override FX tables.
- `Product.customizable` toggles both extra user inputs (player IDs, etc.) and an optional custom unit/quantity field that only appears when the product requires it.
- Manual fulfillment always runs under a `tenant_user` identity; P2P/reseller flows are simply tenant users fulfilling orders for the end users they manage, and tenant users themselves never place orders—`fulfilled_by_type` never uses `end_user`.
- `wallets` stores balances for end users (in their immutable base currency) and providers only, while tenants reference provider statements plus aggregated reporting instead of having wallet rows.
- `user_provider_products.seller_user_id` references tenant staff accounts that can route inbound reseller orders for specific end users inside the same tenant (`can_sell_to_others` flag simply lets staff decide which end users they service).
- Reseller listings may leave `stock_quantity` NULL to indicate on-demand or unbounded capacity; only positive values enforce caps.

---

## 6. API Surface & Routing Strategy
- Server entrypoint: `cmd/api/main.go` → `transport/http/router.go`.
- Global middleware stack: `RequestID`, gzip, CORS, rate limiter, tenant resolver, auth, permissions.
- Versioned prefix `/api/v1` (future `/api/v2`).

### Route Groups & Files
| Group | Prefix | File |
| --- | --- | --- |
| Public | `/health`, `/metrics`, `/swagger/*any` | `transport/http/public.go` |
| Auth | `/api/v1/auth` | `auth.go` |
| Tenant Admin | `/api/v1/admin` | `admin/*.go` |
| End User | `/api/v1/users` | `users/*.go` |
| Orders | `/api/v1/orders` | `orders/*.go` |
| Products | `/api/v1/products` | `products/*.go` |
| Providers | `/api/v1/providers` | `providers/*.go` |
| Webhooks | `/api/v1/webhooks` | `webhooks/*.go` |
| Internal | `/internal/*` | `internal.go` |

Detailed endpoint matrix (login, MFA, CRUD, pricing, provider syncs, webhook ingestion, cron hooks) mirrors Part 2.

---

## 7. Authentication & Authorization
- **Identities:** `super_admin`, `tenant_user`, `end_user`, `api_token`.
- **Tokens:** JWT access (EdDSA/RS256) with `sub`, `tenant_id`, `role`, `scopes`. Refresh tokens stored in Redis (prod) or in-memory (dev) with rotation & revocation.
- **Passwords:** `argon2id`. **MFA:** TOTP via `pquerna/otp` with optional enforcement per tenant.
- **OAuth (prod):** Google/Facebook login hooks still feed into internal JWT issuance.
- **API Tokens:** HMAC header `X-AHLA-Signature` (dev bypass uses static key header `X-AHLA-ApiKey`).
- **Permissions:** `internal/domain/permissions.go` enumerates scopes. Middleware ensures JWT claims align with resolved tenant and that role -> scope mapping allows the handler.

---

## 8. Multi-Tenancy Middleware & Rate Limiting
1. Resolve tenant from subdomain → header fallback → JWT claim.
2. Cache tenant metadata in Redis.
3. Attach `TenantContext` to `gin.Context` for downstream services.
4. Repositories require `tenantID` parameter or automatically scope queries via custom GORM clause.
5. Rate limiting: token bucket per tenant+IP using `ulule/limiter` storing counters in Redis; disabled in dev by default.
6. Audit middleware collects `request_id`, `tenant_id`, `user_id`, pushes to `audit_logs` via asynchronous channel.

---

## 9. Provider Integrations (ZNet & ZDK)
- `internal/providers/client.go` defines `ProviderClient` interface (balance, catalog fetch, place/cancel/get order).
- Implementation per provider with `resty` HTTP client, custom mappers, webhook verification.
- Credentials stored encrypted via `pkg/crypto/secretbox`; each tenant can onboard multiple ZNet/ZDK accounts and rotate them independently.
- Catalog sync job enqueues `provider_sync`; upserts `provider_products` (ZNet-specific fields: `znet_adi_name`, `znet_fiyat_price`, `znet_bilgi_id`, etc.; ZDK uses `zdk_id`).
- Provider request/response details live in `docs/znet.md`/`docs/zdk.md` to keep Go code lean.
- Webhook endpoints validate HMAC/timestamp, enqueue `order_webhook_process` tasks for asynchronous reconciliation.
- Routing rules are configurable per tenant product (with bulk edit tooling): choose manual, pin a provider, or the paid "fulfill by best price" add-on that queries all available providers and orders them by current cost before dispatching.
- Provider failover logic either chooses the next provider from that routing list or escalates to a tenant reseller (`fulfilled_by_type=tenant_user`) within the same tenant.

---

## 10. DTOs, Validation, Observability
- DTOs: `internal/transport/dto/*.go` using validator tags.
- Error contract:
```json
{"error_code":"ORDER_NOT_FOUND","message":"Order not found","details":{"order_id":"..."}}
```
- Observability: `otelgin` for traces, `promhttp` metrics at `/metrics`, zap logs enriched with tenant/user/request IDs, provider client metrics for latency/error.

---

## 11. Background Workers & Async Jobs
- Task queue `asynq` with Redis backend.
- Worker binary `cmd/worker/main.go`; job handlers in `internal/workers/handlers`.
- Queues: `critical` (order fulfillment), `default` (webhook processing), `low` (notifications, catalog sync).
- Scheduler for periodic jobs (order retries, catalog sync, settlement reminders).
- Dead-letter queue monitoring via CLI commands.

| Job | Queue | Purpose |
| --- | --- | --- |
| `order.fulfill` | critical | Execute provider call + update order |
| `order.retry` | default | Reattempt stuck orders |
| `order.webhook.process` | default | Apply webhook updates |
| `catalog.sync` | low | Provider catalog refresh |
| `notification.send` | low | Email/SMS/push |
| `wallet.settlement.reminder` | low | Overdue balance reminder |
| `audit.snapshot` | low | Archive audit logs |

---

## 12. Notification Channels
- `pkg/notify/email` (SES/Mailgun), `pkg/notify/sms` (Twilio/regional), `pkg/notify/push` (FCM/APNs).
- Notification preferences stored in `notification_preferences`; services pick channel mix accordingly.

---

## 13. Testing Strategy & QA Automation
| Layer | Tooling | Notes |
| --- | --- | --- |
| Unit | `testing`, `testify`, `gomock` | Mock repositories/services |
| Integration | SQLite or Postgres via `dockertest`, `httptest` | Real DB + Redis + HTTP server |
| E2E | k6/Postman | Login → order → provider simulation |

CI pipeline: `golangci-lint`, `gosec`, unit tests, integration tests (dockerized Postgres/Redis), build, swagger validation.

---

## 14. Docker, Compose, Deployment
- **Dockerfile:** multi-stage (Go build → distroless runtime) producing `AHLA-api`, `AHLA-worker` binaries.
- **docker-compose:** API, worker, Postgres, Redis for local dev.
- **Env config:** `.env.example`, `config/dev.yaml`, `config/prod.yaml`; secrets via AWS SSM/SOPS in prod.
- **Deployment targets:** Kubernetes (EKS/AKS) or ECS; worker as separate deployment; migrations executed via Job before release; optional Cloud Run for API.
- **CI/CD:** GitHub Actions building multi-arch images, helm upgrades, Slack notifications.

---

## 15. Development Phases & Milestones
| Phase | Focus | Output |
| --- | --- | --- |
| 0 | Foundation | Repo scaffold, migrations, CI skeleton |
| 1 | Core API | Auth, tenant resolver, CRUD baseline, Swagger |
| 2 | Orders & Wallets | End-to-end manual order flow |
| 3 | Provider Integrations | ZNet/ZDK automation, webhook ingestion |
| 4 | Background Workers | Asynq jobs, notifications |
| 5 | Observability & Hardening | Metrics, tracing, rate limits, security tests |
| 6 | Deployment & Scale | Docker/K8s rollout, load testing, E2E gating |

Milestones: M1 (Week3) tenant auth; M2 (Week6) manual orders; M3 (Week9) automated providers; M4 (Week12) prod-ready.

Risks & Mitigations: provider instability (circuit breakers), tenant isolation (automated tests), payment discrepancies (reconciliation jobs), scaling (load tests).

---

## 16. Immediate Next Actions
1. Generate `internal/domain/models.go` from schema (if not already).
2. Scaffold Gin router + empty handlers returning 501 to validate route map.
3. Implement auth JWT issuing & middleware; wire tenant resolver.
4. Stand up Redis/asynq infrastructure for upcoming workers.
5. Mirror plan content in issue tracker to track progress per phase.

---

*Original references remain in* `BACKEND_PLAN_PART1.md`, `BACKEND_PLAN_PART2.md`, `BACKEND_PLAN_PART3.md` *for incremental history.*
