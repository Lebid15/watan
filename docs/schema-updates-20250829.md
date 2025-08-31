## 2025-08-29 Multi-tenant Schema Consolidation

Summary of structural hardening applied this date.

### Added
1. Migration `20250829143000-fix-currencies-and-cleanup` to normalize `currencies` table (adds name/rate/isActive/isPrimary/symbolAr/tenantId, composite unique (tenantId,code), drops legacy columns).
2. Migration `20250829152000-add-tenant-columns` to introduce `tenantId` to `payment_method`, `deposit`, `code_group` with backfill + indexes.
3. Migration `20250829160000-tighten-tenant-columns` to enforce NOT NULL (when safe) on newly added tenant columns.
4. Centralized debug utility (`src/common/debug.util.ts`) consolidating multiple DEBUG_* env flags into a single `DEBUG` variable (supports list values).
5. Demo seed script (`npm run seed:demo`) ensuring base currencies (USD, TRY) and an example payment method.

### Debug Flag Usage
Set `DEBUG=1` (or `true`) to enable all debug logs, or use a list: `DEBUG=tenantCtx,tenantGuard,userProfile`.
Legacy flags like `DEBUG_TENANT_CTX=1` remain honored for backwards compatibility.

### Fresh Deployment Checklist
1. Build backend: `npm run build`
2. Run migrations: `npm run migration:run` (dev) or `npm run migration:run:prod` (prod image)
3. (Optional) Seed demo: `npm run seed:demo` (set TENANT_ID env if targeting specific tenant)

### Rationale
Historic manual SQL hotfixes for tenant isolation were codified into migrations to prevent drift on new environments and to ensure report endpoints function (profit reports depend on TRY / USD rates). Tightening migration adds constraints only when data is already clean to avoid downtime.

---
End of document.
