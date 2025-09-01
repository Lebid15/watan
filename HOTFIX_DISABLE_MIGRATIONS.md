# HOTFIX: Disable Migrations to Restore Service

## Problem
The SeedSiteSettings migration is causing backend container startup failures even with the fix from PR #26. The service is returning 521 errors and is completely down.

## Required Workflow Changes

Please apply these changes manually to `.github/workflows/deploy.yml`:

### Line 16: Change RUN_MIGRATIONS
```yaml
# FROM:
RUN_MIGRATIONS: "true"

# TO:
RUN_MIGRATIONS: "false"
```

### Line 106: Change AUTO_MIGRATIONS  
```yaml
# FROM:
echo "AUTO_MIGRATIONS=true"

# TO:
echo "AUTO_MIGRATIONS=false"
```

## After Applying Changes
1. The deployment will automatically trigger
2. Backend should start successfully without running migrations
3. Service should return to normal (200 responses)
4. We can then investigate the migration issue separately

## Next Steps (After Service Restoration)
1. Collect backend container logs: `docker logs --tail=300 watan-backend`
2. Run migration manually to capture exact error: `docker compose exec -T backend node dist/data-source.js migration:run`
3. Fix SeedSiteSettings migration with proper error handling
4. Test migration fix in separate PR
5. Re-enable migrations once confirmed working

## Urgency
Service is completely down - please apply these changes immediately.
