# Frontend Roadmap (Superadmin · Tenant · End User)

This document defines the next milestones for the three primary personas in the Ahla platform. Each section lists the high-level user flow, backend dependencies, and implementation tasks so the web apps can progress in parallel without rework.

## 1. Superadmin (Platform Owners)

### Core Pages
1. **Auth + Session**
   - `/login`: email/password form wired to `POST /api/v1/superadmin/auth/login`.
   - Session store keeps the JWT in memory (no localStorage) and refreshes profile via `GET /api/v1/superadmin/auth/profile`.
2. **Dashboard**
   - KPIs: total tenants, pending tenants, catalog items. Data pulled from `/api/v1/superadmin/tenants?q=&status=` and `/api/v1/superadmin/products`.
   - Activity feed (latest tenant creations or catalog edits).
3. **Master Catalog**
   - List view + filters using `/api/v1/superadmin/products` with query params (`q`, `category_id`, `available`).
   - Create/edit modals bound to `POST/PUT /api/v1/superadmin/products` and `/categories` endpoints.
   - Inline JSON editors for `input_parameters` & `metadata` with validation.
4. **Tenant Control**
   - Table view backed by `/api/v1/superadmin/tenants` with status chips & search.
   - Detail drawer showing branding/contact info and quick actions (suspend, reset subdomain, open tenant admin portal).
   - Create form that also triggers tenant-admin seeding CLI/API (see section 2).
5. **Provider Ops (Future Sprint)**
   - Central place to inspect provider integrations across tenants; depends on upcoming backend routes.

### Implementation Tasks
- Build a shared API client for the superadmin app with JWT injection and 401 handling.
- Replace mock data in `frontend/superadmin/app/*` with live queries.
- Add toast/error states for mutation responses.
- Provide feature flags so unfinished pages can remain hidden in production.

## 2. Tenant Admins (Per-tenant Control Panel)

### Core Pages
1. **Auth Flow**
   - Continue using Auth0 or introduce tenant-local login once backend exposes tenant auth endpoints.
   - After login, fetch `/api/v1/providers/*`, `/api/v1/provider-credentials`, and future tenant-specific routes.
2. **Dashboard**
   - Revenue summary, latest orders, wallet health.
   - Requires backend order listing and reporting APIs (to be added).
3. **Catalog Management**
   - Bridge master catalog to tenant offerings (enable/disable products, set tiers, set custom pricing).
   - Backend work: endpoints for tenant products and tier pricing.
4. **Orders & Fulfillment**
   - Table for tenant orders, manual fulfillment wizard, escalation to providers.
5. **Settings**
   - Branding, domains, exchange rates, payment methods, provider credentials (existing routes can seed this section).

### Implementation Tasks
- Define tenant-scoped APIs (orders, products, pricing) and update Go server accordingly.
- Wire `frontend/tenants` (and `tenants-app`) to those endpoints, progressively replacing mock data.
- Implement role-based navigation (admin vs support vs finance).

## 3. End Users (Storefront / Agents)

### Core Pages
1. **Home / Catalog**
   - Product listing derived from tenant products + master metadata; requires tenant-friendly public API or SSR layer.
2. **Product Detail & Purchase Flow**
   - Input forms guided by `input_parameters`, wallet balance display, order confirmation.
3. **Wallet & Transactions**
   - Balance, deposit methods, transaction history.
4. **Orders**
   - Track status, request support, view fulfillment details.
5. **Notifications & Announcements**
   - Basic feed of tenant announcements and system alerts.

### Implementation Tasks
- Decide between direct API calls from the agents app vs. tenant-specific BFF (backend-for-frontend).
- Expose public-safe APIs for catalog browsing and order placement with rate limits and CSRF controls.
- Integrate payment/deposit providers once backend routes exist.

## Cross-cutting Concerns
- **Design System**: unify UI components across superadmin/tenant/end-user apps to avoid duplication.
- **Internationalization**: reuse locale files and enforce consistent translation keys.
- **Observability**: surface API latency/error stats in superadmin dashboard for tenant monitoring.
- **Access Management**: ensure JWT scopes or roles align with page requirements (super_admin, tenant_admin, tenant_user, end_user).

## Next Actions
1. Finish backend tooling to seed tenant admins and expose tenant auth endpoints (unblocks tenant dashboard work).
2. Prioritize the superadmin UI wiring to validate the new APIs quickly (catalog + tenants + login).
3. Scope tenant product/order APIs so tenant and end-user pages can move off mock data in the next sprint.
