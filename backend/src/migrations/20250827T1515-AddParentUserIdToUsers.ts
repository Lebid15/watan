import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentUserIdToUsers20250827T1515 implements MigrationInterface {
  name = 'AddParentUserIdToUsers20250827T1515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentUserId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_tenant_parentUser" ON "users" ("tenantId","parentUserId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_tenant_parentUser"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "parentUserId"');
  }
}
