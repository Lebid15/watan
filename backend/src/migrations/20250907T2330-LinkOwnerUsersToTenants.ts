import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LinkOwnerUsersToTenants
 * Ensures that any user referenced by tenant.ownerUserId has its users.tenantId set to that tenant
 * if currently NULL. Idempotent and guarded.
 */
export class LinkOwnerUsersToTenants20250907T2330 implements MigrationInterface {
  name = 'LinkOwnerUsersToTenants20250907T2330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = await queryRunner.query(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('tenant','users')`);
    const haveTenant = tables.some((r: any) => r.table_name === 'tenant');
    const haveUsers = tables.some((r: any) => r.table_name === 'users');
    if (!haveTenant || !haveUsers) return;

    await queryRunner.query(`
      UPDATE users u
      SET "tenantId" = t.id
      FROM tenant t
      WHERE t."ownerUserId" = u.id
        AND (u."tenantId" IS NULL OR u."tenantId" <> t.id)
    `);
  }

  public async down(): Promise<void> { /* no-op */ }
}
