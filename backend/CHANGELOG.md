# Changelog

## Unreleased
### Changed
- Store product listing: Always sorts counter (unit) package first ("باقة العداد") for end-user visibility. Other packages follow ordered by `publicCode` then name. No API contract change besides ordering.

## v1.2 - Webhook Dispatch (Client API)

Features:
- Outbox table `client_api_webhook_outbox` storing webhook events (currently `order-status`).
- Worker (cron every 5s) dispatches pending/failed events with per-user concurrency limit (3).
- HMAC v1 signed requests with headers: `X-Webhook-Signature-Version`, `X-Webhook-Timestamp`, `X-Webhook-Nonce`, `X-Webhook-Signature`.
- Retry/backoff sequence: 0s, 30s, 120s, 600s, 3600s, 21600s then repeats 21600s until attempt 10 → status `dead`.
- Admin endpoints (hidden from public OpenAPI) for listing, retry, mark-dead, redeliver; plus stats endpoint.
- Admin UI page `/admin/client-api/webhooks` with counters, table (last 100), actions, auto-refresh.
- Settings documentation page `/admin/settings/webhooks` describing payload, headers, retry policy, and security.
- Redeliver creates a new pending row preserving original `event_id` for idempotency.
 - Added deterministic HMAC signature verification test.

Guardrails / Behavior:
- Only 2xx responses mark event as `succeeded`.
- Timeout: 15s total (abort after 15s; connect ~10s implicit limit).
- Response code + truncated (512 chars) body snippet stored in `last_error` for failures; secret never logged.
- Concurrency per user limited to 3 in-flight deliveries per tick.

Internal:
- Enqueue integrated on order status change (only when status actually changes and webhooks enabled & configured for user).
- Additional stats endpoint returns counts and succeededToday metric.

Migration required: run latest migrations to create the outbox table.
