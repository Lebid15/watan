import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSourceFlagsProducts20250830T0000 implements MigrationInterface {
  name = 'AddSourceFlagsProducts20250830T0000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isSource" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sourceProductId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_sourceProductId" ON "product" ("sourceProductId")`);

    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "isSource" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "sourcePackageId" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_sourcePackageId_field" ON "product_packages" ("sourcePackageId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_packages_sourcePackageId_field"`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "sourcePackageId"`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "isSource"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_sourceProductId"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "sourceProductId"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "isSource"`);
  }
}
