import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preparatory migration to introduce catalogImageUrl separate from legacy imageUrl.
 * Keeps legacy imageUrl (will be dropped in later cleanup once frontend fully migrated).
 * Backfill rules:
 *  - Add column if missing.
 *  - For rows where useCatalogImage=true AND catalogImageUrl is NULL AND imageUrl IS NOT NULL
 *       set catalogImageUrl = imageUrl.
 */
export class AddCatalogImageUrl20250825T1600 implements MigrationInterface {
  name = 'AddCatalogImageUrl20250825T1600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='catalogImageUrl'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "catalogImageUrl" varchar(500) NULL;
      END IF;

      -- Backfill from legacy imageUrl only where row is still using catalog image
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='imageUrl') THEN
        UPDATE "product"
          SET "catalogImageUrl" = "imageUrl"
        WHERE ("catalogImageUrl" IS NULL OR "catalogImageUrl"='')
          AND ("useCatalogImage" = true OR "useCatalogImage" IS NULL)
          AND "imageUrl" IS NOT NULL;
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Forward-only.
  }
}
