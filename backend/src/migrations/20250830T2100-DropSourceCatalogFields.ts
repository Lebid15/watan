import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Final removal of source / catalog-era columns no longer used post catalog decommission.
 * Columns dropped:
 *  - product.isSource
 *  - product.sourceProductId
 *  - product.catalogAltText
 *  - product_packages.isSource
 *  - product_packages.sourcePackageId
 */
export class DropSourceCatalogFields20250830T2100 implements MigrationInterface {
  name = 'DropSourceCatalogFields20250830T2100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Product table
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "isSource"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "sourceProductId"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "catalogAltText"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_sourceProductId"`);

    // Product packages
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "isSource"`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "sourcePackageId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_packages_sourcePackageId_field"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate columns (minimal definition) for rollback safety
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isSource" boolean DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sourceProductId" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "catalogAltText" varchar(300)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_sourceProductId" ON "product" ("sourceProductId")`);

    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "isSource" boolean DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "sourcePackageId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_sourcePackageId_field" ON "product_packages" ("sourcePackageId")`);
  }
}
