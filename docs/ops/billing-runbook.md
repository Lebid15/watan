# Billing Runbook (Operations)

Kill Switch:
Set `FEATURE_BILLING_V1=false` and restart backend. Billing guard & schedulers become inert; data remains unchanged.

Quick Health Check:
1. `GET /api/admin/billing/health` (requires instance_owner token) → verify timestamps & counts.
2. `GET /metrics` → inspect `billing_invoices_created_total`, `billing_enforcement_suspended_total`, `billing_open_invoices`, `billing_suspended_tenants`.

If locks appear stuck: delete `billing:lock:*` keys from Redis (only if certain no job running).

If suspended tenants should be unsuspended after payment but aren’t: confirm invoice status=paid and next enforcement ran (check `lastEnforceAt`).
