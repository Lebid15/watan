# Billing API (billingV1)

## Overview
Billing V1 introduces monthly invoice periods, automated end‑of‑month (EOM) issuance, overdue detection, subscription suspension (TENANT_SUSPENDED), and structured payment (deposit) requests. It is gated by the feature flag `billingV1` so it can be staged and rolled out safely. The layer exposes tenant and admin endpoints for monitoring invoices, requesting manual deposits, and administrative reconciliation (mark paid).

Core primitives:
* Config: `tenant_billing_config` (trial, graceDays)
* Subscription lifecycle: `tenant_subscriptions` (ACTIVE | SUSPENDED)
* Invoices: `billing_invoices` (OPEN | PAID | OVERDUE) with monetary precision (numeric(18,6)) and display helper `amountUSD3` (3 decimals).
* Deposits (payment requests) link optional invoice → reduce outstanding balance (future settlement logic).

No schema changes are introduced in this documentation step (Step 7). All referenced tables already exist.

## Data Model (Summary Only)
`tenant_billing_config`:
```
tenantId, graceDays, trialEndsAt, createdAt
```
`tenant_subscriptions`:
```
tenantId, status, suspendAt, suspendReason
```
`billing_invoices`:
```
id, tenantId, status, amountUsd, issuedAt, dueAt, paidAt, periodStart, periodEnd
```
Monetary fields are persisted at 6 fractional digits; `amountUSD3` is a presentation trimming (Number → fixed(3)).

## Periods & Issuance
* Anchor: Calendar month (UTC). Period example: 2025‑08‑01 → 2025‑08‑31.
* Trial: First month (or configured trial) can suppress issuance.
* Issuance: 23:55 UTC on EOM (slight buffer before midnight) creates OPEN invoice if trial ended.
* dueAt = issuedAt + graceDays (default 5 days).
* Overdue: now > dueAt AND status still OPEN ⇒ status logically treated as OVERDUE (or updated by job).
* Suspension: subscription.status=SUSPENDED after enforcement job runs past due.
* nextDueAt = open invoice dueAt OR predicted next cycle due date.

ASCII Timeline:
```
|<------------------ Billing Period ------------------>| EOM Issue  Grace  Due
2025-08-01                                    2025-08-31 23:55  --->  +5d  (dueAt)
                                                     | overdue detection after dueAt
```

## Jobs (Schedulers)
| Job | Time (UTC) | Function |
|-----|------------|----------|
| Issue | 23:55 (EOM) | Create monthly invoice (idempotent per tenant+period) |
| Enforcement | 00:10 (next day) | Suspend tenants with unpaid past-due invoices |
| Reminders | 08:00 (daily) | (Pluggable) send reminder notifications |

Idempotency: Each issuance checks existence of same periodStart+periodEnd invoice. Locking kept light (single host) – can be hardened with advisory locks later.

## Guards & Roles
Ordering (global): TenantGuard → FinalRolesGuard → BillingGuard.
* TenantGuard: Asserts tenant context & cross‑tenant isolation.
* FinalRolesGuard: Enforces mapped role (`tenant_owner`, `instance_owner`, etc.).
* BillingGuard: Blocks non‑billing tenant routes when subscription is SUSPENDED (returns 403 TENANT_SUSPENDED) but allows `/api/tenant/billing/overview` so tenant can see status.

Access Matrix (simplified):
| Route Prefix | Allowed Roles | Suspension Behavior |
|--------------|---------------|---------------------|
| /api/tenant/billing/* | tenant_owner | Overview allowed even if suspended |
| /api/admin/billing/*  | instance_owner (developer maps to instance_owner) | N/A |
| /api/tenant/* (other) | tenant_owner / distributor (legacy) | Blocked w/ TENANT_SUSPENDED |
| /api/external/* | external token scope based | Outside scope here |

## Tenant API
### GET /api/tenant/billing/overview
Example Response:
```json
{
  "status": "ACTIVE",
  "currentPeriodStart": "2025-08-01",
  "currentPeriodEnd": "2025-08-31",
  "nextDueAt": "2025-09-05T00:00:00.000Z",
  "openInvoiceCount": 1,
  "overdue": false,
  "daysOverdue": 0,
  "daysUntilDue": 4,
  "lastInvoice": {
    "id": "inv_123",
    "status": "open",
    "amountUsd": "125.000000",
    "amountUSD3": "125.000",
    "issuedAt": "2025-08-31T23:55:12.000Z",
    "dueAt": "2025-09-05T00:00:00.000Z",
    "paidAt": null
  }
}
```
### GET /api/tenant/billing/invoices?status=&overdue=
Item Example:
```json
{
  "id": "inv_123",
  "status": "open",
  "amountUsd": "125.000000",
  "amountUSD3": "125.000",
  "periodStart": "2025-08-01",
  "periodEnd": "2025-08-31",
  "issuedAt": "2025-08-31T23:55:12.000Z",
  "dueAt": "2025-09-05T00:00:00.000Z",
  "paidAt": null
}
```
### POST /api/tenant/billing/payments/request
Request:
```json
{ "amountUsd": 50, "methodId": "pm_abc", "invoiceId": "inv_123" }
```
Success (201):
```json
{ "depositId": "dep_789", "status": "pending", "invoiceId": "inv_123" }
```
422 Errors:
```json
{ "statusCode": 422, "code": "INVALID_AMOUNT", "message": "Amount must be > 0" }
{ "statusCode": 422, "code": "METHOD_REQUIRED", "message": "methodId required" }
{ "statusCode": 422, "code": "INVOICE_NOT_OPEN", "message": "Invoice is not open" }
```

#### cURL (Tenant)
```bash
curl -H "Authorization: Bearer <TOKEN>" -H "X-Tenant-Id: <TENANT_ID>" https://api.example.com/api/tenant/billing/overview
curl -H "Authorization: Bearer <TOKEN>" -H "X-Tenant-Id: <TENANT_ID>" "https://api.example.com/api/tenant/billing/invoices?overdue=true"
curl -X POST -H "Authorization: Bearer <TOKEN>" -H "X-Tenant-Id: <TENANT_ID>" -H "Content-Type: application/json" \
  https://api.example.com/api/tenant/billing/payments/request \
  -d '{"amountUsd":50,"methodId":"pm_abc","invoiceId":"inv_123"}'
```

## Admin API
### GET /api/admin/billing/tenants?status=&overdue=&limit=&offset=
Tenant Row:
```json
{
  "tenantId": "t1",
  "tenantCode": "alpha",
  "tenantName": "Alpha Store",
  "status": "ACTIVE",
  "nextDueAt": "2025-09-05T00:00:00.000Z",
  "openInvoices": 1,
  "overdueOpenInvoices": 0,
  "lastInvoiceAmountUsd": "125.000000",
  "lastInvoiceAmountUSD3": "125.000"
}
```
### GET /api/admin/billing/tenants/:tenantId/invoices
Returns same shape as tenant invoices (includes `amountUSD3`).
### POST /api/admin/billing/invoices/:id/mark-paid
Request: `{ "depositId": "dep_789" }`
Success:
```json
{ "ok": true, "invoiceId": "inv_123", "status": "paid" }
```
#### cURL (Admin)
```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://api.example.com/api/admin/billing/tenants?overdue=true&limit=20
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  https://api.example.com/api/admin/billing/invoices/inv_123/mark-paid \
  -d '{"depositId":"dep_789"}'
```

## Error Envelope
Unified pattern:
```json
{
  "statusCode": 403,
  "code": "TENANT_SUSPENDED",
  "message": "Tenant is suspended due to overdue invoices",
  "timestamp": "2025-08-27T10:12:33.123Z",
  "path": "/api/tenant/orders",
  "retryAt": "2025-08-28T00:00:00.000Z"
}
```
422 Examples (already shown) follow identical envelope (without retryAt).

## Feature Flags
* Staging: set `FEATURE_BILLING_V1=true` (or mutate `FEATURE_FLAGS.billingV1 = true` during app bootstrap/tests).
* Production Canary: keep default `false`; selectively enable for a small tenant cohort.
* Monitoring: track 4xx (422/403 TENANT_SUSPENDED) rates + latency of issuance/enforcement jobs.
* Kill Switch: set `FEATURE_BILLING_V1=false` then restart service. Guard & schedulers become inert; no data is deleted.

## Rollout Plan
1. Staging Verification – simulate issuance at month boundary, validate overview metrics.
2. Canary – enable for 5–10 production tenants; observe error & payment request patterns.
3. General Availability – flip global flag; announce & add dashboard KPIs (openInvoiceCount, overdue ratio).

## FAQ
**Why USD only?** Simplicity; multi‑currency would require FX snapshot & per-invoice currency. Display conversion can be layered later.
**What if FX changes?** Historical invoices remain USD; optional real‑time display conversion can be added (not stored).
**How is suspension lifted?** Paying (mark paid or deposit covering amount) transitions invoice to PAID; enforcement / manual unsuspend sets subscription ACTIVE.
**Why amountUSD3 and amountUsd?** amountUsd preserves original precision (6); amountUSD3 is trimmed for UI/summary.

## Change Log (Phase 5 Steps 1–6)
* Step 1: Module & entity scaffolding (config, subscription, invoice).
* Step 2: Issuance logic + basic metrics.
* Step 3: BillingGuard & suspension integration.
* Step 4: Deposit creation & overview enrichment.
* Step 5: Admin & tenant APIs, error formatting, amountUSD3 display.
* Step 6: E2E tests (overview, invoices, payments, admin) + validation errors (INVALID_AMOUNT, METHOD_REQUIRED, INVOICE_NOT_OPEN, TENANT_SUSPENDED envelope).

Related Migrations (already applied earlier – names only):
```
20250827T1400-AddLinkCodeToCatalogPackage.ts
20250827T1415-AddCatalogProductIdToProduct.ts
20250827T1425-AddCatalogLinkCodeToProductPackage.ts
20250827T1430-AddCreatedByDistributorToProductPackage.ts
20250827T1450-DistributorPricingTables.ts
20250827T1455-AddPlacedByDistributorToOrders.ts
20250827T1505-AddDistributorSnapshotsToOrders.ts
20250827T1515-AddParentUserIdToUsers.ts
20250827T1525-AddFxDistributorAtOrder.ts
20250828T1000-AddApiEnabledToUsers.ts
20250828T1010-CreateTenantApiTokens.ts
20250828T1020-CreateIdempotencyKeys.ts
```

## No DB Changes
This step is documentation only: no new tables, columns, or constraints.
