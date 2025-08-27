import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalogLinkCodeToProductPackage20250827T1425 implements MigrationInterface {
  name = 'AddCatalogLinkCodeToProductPackage20250827T1425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "catalogLinkCode" varchar(80)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_packages_catalogLinkCode" ON "product_packages" ("catalogLinkCode")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_packages_catalogLinkCode"`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "catalogLinkCode"`);
  }
}
