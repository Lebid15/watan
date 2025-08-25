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
    await queryRunner.query(`DO $$
    DECLARE
      legacy_remaining int;
    BEGIN
      -- Backfill catalogImageUrl from legacy for catalog-using rows
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='imageUrl') THEN
        UPDATE "product"
          SET "catalogImageUrl" = COALESCE("catalogImageUrl", "imageUrl")
        WHERE ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
          AND ("useCatalogImage" = true OR "useCatalogImage" IS NULL)
          AND "imageUrl" IS NOT NULL;
      END IF;

      -- Count rows where custom image not used AND catalogImageUrl still NULL while legacy has value (should be 0 after backfill)
      SELECT COUNT(*) INTO legacy_remaining FROM "product"
        WHERE ("useCatalogImage" = true OR "useCatalogImage" IS NULL)
          AND ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
          AND "imageUrl" IS NOT NULL;

      RAISE NOTICE 'PrepareDropLegacyProductImage: remaining legacy-dependent rows=%', legacy_remaining;
    END $$;`);
  }

  public async down(): Promise<void> {
    // No rollback needed.
  }
}
