import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final migration: drop legacy product.imageUrl column (after prior prep & backfill).
 * Safe to run multiple times (IF EXISTS). Ensure application version using catalogImageUrl & customImageUrl is deployed first.
 */
export class DropLegacyProductImage20250825T1800 implements MigrationInterface {
  name = 'DropLegacyProductImage20250825T1800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='imageUrl'
      ) THEN
        ALTER TABLE "product" DROP COLUMN "imageUrl";
        RAISE NOTICE 'Dropped legacy column product.imageUrl';
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Not recreating the legacy column.
  }
}
