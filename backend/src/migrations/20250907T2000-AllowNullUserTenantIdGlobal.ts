import { MigrationInterface, QueryRunner } from 'typeorm';

// Makes users.tenantId nullable again (needed for global developer / instance_owner accounts)
// Idempotent: only drops NOT NULL if currently enforced. Down migration re-applies NOT NULL only if no NULL rows exist.
export class AllowNullUserTenantIdGlobal20250907T2000 implements MigrationInterface {
  name = 'AllowNullUserTenantIdGlobal20250907T2000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const col: any[] = await queryRunner.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name='users' AND column_name='tenantId'
    `);
    if (col.length && col[0].is_nullable === 'NO') {
      await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL`);
      // eslint-disable-next-line no-console
      console.log('[Migration] Dropped NOT NULL on users.tenantId');
    } else {
      // eslint-disable-next-line no-console
      console.log('[Migration] users.tenantId already nullable – skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-apply NOT NULL only if no NULL values exist (safety)
    const nulls: any[] = await queryRunner.query(`SELECT count(*)::int AS c FROM users WHERE "tenantId" IS NULL`);
    if (nulls[0]?.c === 0) {
      await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "tenantId" SET NOT NULL`);
      // eslint-disable-next-line no-console
      console.log('[Migration][DOWN] Re-applied NOT NULL on users.tenantId');
    } else {
      // eslint-disable-next-line no-console
      console.log('[Migration][DOWN] Skipped re-applying NOT NULL (found NULL rows)');
    }
  }
}
