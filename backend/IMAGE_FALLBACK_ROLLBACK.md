# Product Image Fallback Rollback / Contingency

This document explains how to revert (as much as feasible) after the final legacy `product.imageUrl` column was dropped (migration `20250825T1800-DropLegacyProductImage`). Use only if a critical regression forces a temporary fallback.

## Current Final State (Post-Migration)
- Active columns: `customImageUrl`, `useCatalogImage`, `catalogImageUrl`.
- Dropped column: `imageUrl` (legacy).
- Effective image logic lives in `ProductsService.mapEffectiveImage()`.
- Admin endpoints manage custom vs catalog image sources.

## Fast Diagnostic Checklist
1. Check latest metrics snapshot (cron every 12h) or run: `npm run metrics:product-images`.
2. Inspect recent audit events for product image changes (`product.image.*`).
3. Verify a sample API response `/api/products` includes expected fields.
4. Confirm no 500 errors in logs referencing missing `imageUrl` column.

## Rollback Strategy Overview
There is no perfectly lossless “undo” because we intentionally migrated away from the legacy column. However, you can reintroduce a compatibility column and repopulate it from new fields to satisfy old binaries if absolutely necessary.

### Option A: Soft Shim (Preferred)
Keep the schema as-is. Add a virtual (computed) field in responses named `imageUrl` (already effectively done) so old clients that only read a field called `imageUrl` keep working. (This is already implemented: controllers still emit `imageUrl` = effective image.) No DB change required.

### Option B: Recreate Legacy Column (Last Resort)
1. Create a new migration (example):
   ```sql
   ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "imageUrl" varchar(500) NULL;
   UPDATE "product" SET "imageUrl" = COALESCE("customImageUrl", "catalogImageUrl") WHERE "imageUrl" IS NULL;
   CREATE INDEX IF NOT EXISTS idx_product_image_legacy ON "product"("imageUrl");
   ```
2. Adjust `Product` entity to add back `imageUrl?: string | null;`.
3. (Optional) On each custom image change, also mirror into `imageUrl` for old services: modify `updateImage()` and admin endpoints.
4. Plan a second removal window once legacy clients are updated.

### Option C: Hotfix Fallback
If only a handful of SKUs affected (missing effective image):
1. Run a manual SQL patch: `UPDATE product SET catalogImageUrl = <url> WHERE id='<id>';`
2. If `useCatalogImage=false` ensure `customImageUrl` is set.
3. Re-run metrics snapshot to confirm reduction in `missing` count.

## Data Integrity Checks
Use these queries before and after any rollback action:
```sql
-- Products missing any effective image
SELECT COUNT(*) FROM product
 WHERE (customImageUrl IS NULL OR useCatalogImage = true)
   AND catalogImageUrl IS NULL;

-- Custom-only usage
SELECT COUNT(*) FROM product WHERE customImageUrl IS NOT NULL AND useCatalogImage = false;

-- Catalog usage
SELECT COUNT(*) FROM product WHERE (useCatalogImage = true OR customImageUrl IS NULL);
```

## Re-Synchronizing from Catalog
If catalog images were lost, you can re-run catalog image propagation via existing admin endpoints or (bulk) by scripting an update:
```sql
UPDATE product p SET catalogImageUrl = cp.imageUrl
FROM catalog_product cp
WHERE p.catalogImageUrl IS NULL AND cp.name = p.name;
```
(This assumes product names align with catalog names.)

## Monitoring After Any Rollback Action
- Run `npm run metrics:product-images` immediately and again after traffic resumes.
- Watch logs for `[snapshot] custom= catalog= missing=` lines.
- Set a calendar reminder to remove any temporary recreated `imageUrl` column within agreed SLA.

## Re-Removal Procedure (If Column Recreated)
1. Ensure `SELECT COUNT(*) ...` for legacy-dependent rows returns 0.
2. Create new drop migration similar to `DropLegacyProductImage20250825T1800`.
3. Deploy with updated services relying only on new fields.

## Common Pitfalls
- Forgetting to mirror updates into recreated `imageUrl` leads to stale images for legacy clients.
- Reintroducing column without an index may slow old queries expecting it.
- Not updating tests: add conditional tests if you temporarily restore the column.

## Summary
You likely do NOT need a database rollback because responses already expose `imageUrl` (effective). Only recreate the column if a binary truly queries the schema directly. Prefer soft shim.

---
Document version: 2025-08-25
