import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop legacy catalog-related fields from product & product_packages tables:
 *  - product.catalogProductId
 *  - product.catalogImageUrl
 *  - product.useCatalogImage
 *  - product_packages.catalogLinkCode
 * Also drop associated indexes if they exist.
 */
export class DropCatalogFields20250830T1900 implements MigrationInterface {
  name = 'DropCatalogFields20250830T1900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PRODUCT table
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='catalogProductId') THEN
        ALTER TABLE "product" DROP COLUMN "catalogProductId";
      END IF;
    END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='catalogImageUrl') THEN
        ALTER TABLE "product" DROP COLUMN "catalogImageUrl";
      END IF;
    END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='useCatalogImage') THEN
        ALTER TABLE "product" DROP COLUMN "useCatalogImage";
      END IF;
    END $$;`);

    // PRODUCT_PACKAGES table
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_packages' AND column_name='catalogLinkCode') THEN
        ALTER TABLE "product_packages" DROP COLUMN "catalogLinkCode";
      END IF;
    END $$;`);

    // Drop related indexes (ignore errors if absent)
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_product_catalogProductId";');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_product_packages_catalogLinkCode_field";');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate columns (without data backfill) for rollback scenario
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "catalogProductId" uuid`);
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "catalogImageUrl" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "useCatalogImage" boolean DEFAULT true`);
    await queryRunner.query(`UPDATE "product" SET "useCatalogImage" = COALESCE("useCatalogImage", true)`);
    await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "useCatalogImage" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "catalogLinkCode" varchar(80)`);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_product_catalogProductId" ON "product" ("catalogProductId");');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_product_packages_catalogLinkCode_field" ON "product_packages" ("catalogLinkCode");');
  }
}
