# Diagnostics & Temporary Flags

| Flag | Purpose | Effect |
|------|---------|--------|
| `NEXT_PUBLIC_DISABLE_ADMIN_SCALE` | Temporarily disable admin global transform scaling | Admin layout renders at natural 1280px without scale wrapper. |
| `NEXT_PUBLIC_DISABLE_USER_FALLBACK` | Skip pre-hydration local token fallback user painting | Prevents possible hydration mismatch from immediate setUser(fallback). |

## When to Use
Use these flags only while investigating client-side hydration or runtime issues (e.g., React minified error #310). Remove or unset them once root cause is fixed.

## How to Apply
Add to build/deployment environment (e.g. `.env.production`):
```
NEXT_PUBLIC_DISABLE_ADMIN_SCALE=1
NEXT_PUBLIC_DISABLE_USER_FALLBACK=1
```
Then rebuild and redeploy.

## Order of Testing
1. Disable admin scale → verify if error persists on tenant pages.
2. Disable user fallback → verify if error vanishes (points to early DOM divergence).
3. Re-enable features one by one after a stable state.

## Cleanup
Delete the flags once diagnostics complete to restore intended UX.
