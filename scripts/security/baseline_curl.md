# Manual Baseline Security Probes

## CORS (Allowed Origin)
```
curl -i https://api.wtn4.com/api/auth/login \
  -H "Origin: https://wtn4.com" -X OPTIONS \
  -H "Access-Control-Request-Method: POST"
```
Expect: 204 + Access-Control-Allow-Origin: https://wtn4.com

## CORS (Blocked Origin)
```
curl -i https://api.wtn4.com/api/auth/login \
  -H "Origin: https://evil.com" -X OPTIONS \
  -H "Access-Control-Request-Method: POST"
```
Expect: No Access-Control-Allow-Origin header.

## Dev Endpoint Protection
```
curl -i https://api.wtn4.com/api/dev/maintenance-status
```
Should be 401/403 if no auth.

## Tenant Host Required
```
curl -i https://api.wtn4.com/api/products -H "Origin: https://storeX.wtn4.com"
```
Expect: 400/403 (no X-Tenant-Host)

```
curl -i https://api.wtn4.com/api/products -H "Origin: https://storeX.wtn4.com" -H "X-Tenant-Host: storeX.wtn4.com"
```
Expect: 200 (if authenticated) or 401 if not.

## Maintenance Bypass Cookie
```
# After visiting /dev ensure:
curl -I https://wtn4.com/login | findstr /R "X-Serve-Maint: 0"
```

## Login POST CORS Headers
```
curl -i -X POST https://api.wtn4.com/api/auth/login \
  -H "Origin: https://wtn4.com" -H "Content-Type: application/json" \
  --data '{"email":"demo","password":"x"}'
```
Expect: Access-Control-Allow-Origin present (even on 401).
