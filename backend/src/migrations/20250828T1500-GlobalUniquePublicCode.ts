import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalUniquePublicCode20250828T1500 implements MigrationInterface {
  name = 'GlobalUniquePublicCode20250828T1500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code_tenant";`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_public_code" ON "product_packages" ("publicCode");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_pkg_publicCode_notnull" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pkg_publicCode_notnull";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_public_code_tenant" ON "product_packages" ("tenantId","publicCode");`);
  }
}
