## v1.1 (2025-09-05)
* Added product metadata (qty modes: null, fixed, range, list)
* Exposed qty_values shapes and params keys in /client/api/products
* Enforced quantity + params validation with error codes 106/112/113/114
* Documented idempotency via order_uuid, check endpoint uuid=1 flag
* Published updated OpenAPI (openapi-client.json)
* Added OpenAPI api-key security scheme (api-token), examples for newOrder & check
* Added tests: metadata validation, logging prune (last 20), rate limit 429, IP normalization

## v1.0 (initial)
* Phase1 core endpoints (profile, products, content, newOrder, check)
* Error envelope {code,message}; idempotent newOrder; price group support