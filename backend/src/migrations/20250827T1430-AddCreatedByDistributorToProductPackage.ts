import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedByDistributorToProductPackage20250827T1430 implements MigrationInterface {
  name = 'AddCreatedByDistributorToProductPackage20250827T1430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "createdByDistributorId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_packages_createdByDistributorId" ON "product_packages" ("createdByDistributorId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_packages_createdByDistributorId"`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "createdByDistributorId"`);
  }
}
