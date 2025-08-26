import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1: Introduce image fallback fields on product (tenant product):
 *  - customImageUrl (nullable)
 *  - useCatalogImage (boolean, default true)
 * Backfill strategy:
 *  If existing legacy product.imageUrl is NOT NULL =>
 *    move its value to customImageUrl and set useCatalogImage=false.
 *  (We keep legacy column untouched for now to avoid breaking runtime code; cleanup in later phase.)
 * Idempotent / safe style: checks for column existence before alterations.
 */
export class AddProductImageFallbackFields20250825T1500 implements MigrationInterface {
  name = 'AddProductImageFallbackFields20250825T1500';

  // NOTE: Subsequent migrations (AddCatalogImageUrl, PrepareDropLegacyProductImage, DropLegacyProductImage)
  // check for the presence of useCatalogImage. If for any reason this migration was skipped,
  // later ones now degrade gracefully (20250825T1700 made defensive). Keep standard chronological ordering.

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    DO $$
    BEGIN
      -- Add customImageUrl column if missing
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product' AND column_name='customImageUrl'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "customImageUrl" varchar(500) NULL;
      END IF;

      -- Add useCatalogImage column if missing
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product' AND column_name='useCatalogImage'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "useCatalogImage" boolean NULL;
        UPDATE "product" SET "useCatalogImage" = true WHERE "useCatalogImage" IS NULL; -- default true
        ALTER TABLE "product" ALTER COLUMN "useCatalogImage" SET NOT NULL;
      END IF;

      -- Backfill: migrate existing legacy imageUrl values to customImageUrl ONLY where customImageUrl is null
      -- and set useCatalogImage = false to indicate using tenant-specific image.
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='imageUrl') THEN
        UPDATE "product"
          SET "customImageUrl" = COALESCE("customImageUrl", "imageUrl"),
              "useCatalogImage" = CASE 
                WHEN "imageUrl" IS NOT NULL THEN false 
                ELSE "useCatalogImage" 
              END
        WHERE ("imageUrl" IS NOT NULL AND "customImageUrl" IS NULL)
           OR ("imageUrl" IS NOT NULL AND "useCatalogImage" = true);
      END IF;

      -- Defensive index (may be useful for queries filtering on tenant + useCatalogImage)
      BEGIN
        CREATE INDEX IF NOT EXISTS "idx_product_tenant_useCatalogImage" ON "product" ("tenantId", "useCatalogImage");
      EXCEPTION WHEN others THEN NULL; END;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Non-destructive reversible removal intentionally omitted (forward-only migration style).
  }
}
