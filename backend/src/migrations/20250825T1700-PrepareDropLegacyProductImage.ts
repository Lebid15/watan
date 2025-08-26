import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preparation (non-destructive) before dropping legacy product.imageUrl column.
 * Steps:
 *  - Ensure catalogImageUrl populated wherever useCatalogImage=true and imageUrl present.
 *  - Count remaining legacy-dependent rows and RAISE NOTICE (for operator visibility in logs).
 *  - DOES NOT drop the column. A later migration will actually remove it when counts are zero/accepted.
 */
export class PrepareDropLegacyProductImage20250825T1700 implements MigrationInterface {
  name = 'PrepareDropLegacyProductImage20250825T1700';

  public async up(queryRunner: QueryRunner): Promise<void> {
  // NOTE: This version is defensive. If you still see errors referencing
  // useCatalogImage it likely means the old compiled JS (dist) for this
  // migration is still being used. Rebuild the backend image (npm run build)
  // to ensure dist/migrations contains the updated logic.
    await queryRunner.query(`DO $$
    DECLARE
      legacy_remaining int := 0;
      has_use_catalog boolean := false;
      has_catalog_image boolean := false;
      has_legacy_image boolean := false;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product' AND column_name='useCatalogImage'
      ) INTO has_use_catalog;

      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product' AND column_name='catalogImageUrl'
      ) INTO has_catalog_image;

      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product' AND column_name='imageUrl'
      ) INTO has_legacy_image;

      -- Ensure target column exists (idempotent add if missing)
      IF NOT has_catalog_image THEN
        BEGIN
          ALTER TABLE "product" ADD COLUMN "catalogImageUrl" varchar(500);
          has_catalog_image := true;
          RAISE NOTICE 'PrepareDropLegacyProductImage: added missing catalogImageUrl column';
        EXCEPTION WHEN duplicate_column THEN
          has_catalog_image := true; -- race-safe
        END;
      END IF;

      IF has_catalog_image AND has_legacy_image THEN
        IF has_use_catalog THEN
          UPDATE "product"
            SET "catalogImageUrl" = COALESCE("catalogImageUrl", "imageUrl")
          WHERE ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
            AND ("useCatalogImage" = true OR "useCatalogImage" IS NULL)
            AND "imageUrl" IS NOT NULL;
        ELSE
          UPDATE "product"
            SET "catalogImageUrl" = COALESCE("catalogImageUrl", "imageUrl")
          WHERE ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
            AND "imageUrl" IS NOT NULL;
        END IF;
      END IF;

      IF has_catalog_image AND has_legacy_image THEN
        IF has_use_catalog THEN
          SELECT COUNT(*) INTO legacy_remaining FROM "product"
            WHERE ("useCatalogImage" = true OR "useCatalogImage" IS NULL)
              AND ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
              AND "imageUrl" IS NOT NULL;
        ELSE
          SELECT COUNT(*) INTO legacy_remaining FROM "product"
            WHERE ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
              AND "imageUrl" IS NOT NULL;
        END IF;
      END IF;

      RAISE NOTICE 'PrepareDropLegacyProductImage: remaining legacy-dependent rows=% (useCatalogImage present=% has_catalog_image=% has_legacy_image=%)', legacy_remaining, has_use_catalog, has_catalog_image, has_legacy_image;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No rollback needed.
  }
}
