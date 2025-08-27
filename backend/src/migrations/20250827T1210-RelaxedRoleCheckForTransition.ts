import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1: إضافة CHECK مرن يسمح بالأدوار القديمة والجديدة
export class RelaxedRoleCheckForTransition20250827T1210 implements MigrationInterface {
  name = 'RelaxedRoleCheckForTransition20250827T1210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // احذف أي قيود سابقة على role (إن وجدت)
    try { await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role_transition'); } catch {}
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT chk_users_role_transition CHECK (role IN (
      'developer','admin','user','instance_owner','distributor','tenant_owner','end_user'
    ))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try { await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role_transition'); } catch {}
    // لا نعيد قيد قديم محدد (تراجع بسيط)
  }
}
