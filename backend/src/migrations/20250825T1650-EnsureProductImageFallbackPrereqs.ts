import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety net migration inserted before 1700 to guarantee the existence of
 * prerequisite columns for the image fallback feature.
 *
 * Some environments hit 1700 (PrepareDropLegacyProductImage) without having
 * successfully applied 1500 (AddProductImageFallbackFields) yet, causing
 * references to useCatalogImage to fail. This migration is idempotent: it only
 * adds the needed columns if they are missing and sets defaults.
 */
export class EnsureProductImageFallbackPrereqs20250825T1650 implements MigrationInterface {
  name = 'EnsureProductImageFallbackPrereqs20250825T1650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      -- customImageUrl
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='customImageUrl'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "customImageUrl" varchar(500) NULL;
      END IF;

      -- useCatalogImage
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='useCatalogImage'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "useCatalogImage" boolean NULL;
        UPDATE "product" SET "useCatalogImage" = true WHERE "useCatalogImage" IS NULL;
        ALTER TABLE "product" ALTER COLUMN "useCatalogImage" SET NOT NULL;
      END IF;

      -- catalogImageUrl (needed later for backfill logic)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='catalogImageUrl'
      ) THEN
        ALTER TABLE "product" ADD COLUMN "catalogImageUrl" varchar(500) NULL;
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Forward-only; do not drop columns once created.
  }
}
