import { MigrationInterface, QueryRunner } from 'typeorm';

// Legacy catalog migration retained for historical reference; safe no-op if table absent.
export class AddLinkCodeToCatalogPackage20250827T1400 implements MigrationInterface {
  name = 'AddLinkCodeToCatalogPackage20250827T1400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_package" ADD COLUMN IF NOT EXISTS "nameDefault" varchar(200)`);
    await queryRunner.query(`ALTER TABLE "catalog_package" ADD COLUMN IF NOT EXISTS "linkCode" varchar(80)`);
    await queryRunner.query(`UPDATE "catalog_package" SET "linkCode" = NULL WHERE trim(coalesce("linkCode", '')) = ''`);
    // Use quoted column in partial index predicate to avoid 42703 when case differs
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_package_catalogProduct_linkCode" ON "catalog_package" ("catalogProductId", "linkCode") WHERE "linkCode" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_catalog_package_catalogProduct_linkCode"`);
    await queryRunner.query(`ALTER TABLE "catalog_package" DROP COLUMN IF EXISTS "linkCode"`);
    await queryRunner.query(`ALTER TABLE "catalog_package" DROP COLUMN IF EXISTS "nameDefault"`);
  }
}
