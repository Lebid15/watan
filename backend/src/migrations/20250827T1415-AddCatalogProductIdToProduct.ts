import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalogProductIdToProduct20250827T1415 implements MigrationInterface {
  name = 'AddCatalogProductIdToProduct20250827T1415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "catalogProductId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_catalogProductId" ON "product" ("catalogProductId")`);
    // لاحقًا: backfill + constraint uniqueness per tenant
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_catalogProductId"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "catalogProductId"`);
  }
}
