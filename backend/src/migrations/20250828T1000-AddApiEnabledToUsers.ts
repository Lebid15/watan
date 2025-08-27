import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiEnabledToUsers20250828T1000 implements MigrationInterface {
  name = 'AddApiEnabledToUsers20250828T1000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiEnabled" boolean NULL DEFAULT false`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_tenant_apiEnabled" ON "users" ("tenantId","apiEnabled")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_apiEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiEnabled"`);
  }
}
