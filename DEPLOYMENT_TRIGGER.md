# Deployment Trigger

This file is used to trigger a new deployment after fixing container cleanup issues.

Deployment triggered at: 2025-08-31 23:03:58 UTC
Purpose: Deploy API fixes from PR #19 after resolving watan-redis container conflicts

## Force rebuild 2025-09-01 00:14:26 UTC
Purpose: Force complete Docker rebuild to apply PR #19 fixes for:
- API pages 500 errors (PagesController tenantId fix)
- /menu 404 errors (middleware redirect fix)  
- Passkey 400 errors (authentication requirement clarification)

## Critical fixes deployment 2025-09-03 16:24:51 UTC
Purpose: Deploy PR #39 comprehensive fixes for 4 critical production issues:
- Clone button in /dev/filtered_products showing no global products (seed DEV_TENANT_ID)
- Passkey login "Cannot read properties of undefined (reading 'replace')" error (JWT parsing null checks)
- Mobile view showing desktop layout on admin/dev pages (responsive viewport configuration)
- Password reset emails not being sent (SMTP email service configuration)

Commit: bbc1d3f - All fixes merged and ready for production deployment
