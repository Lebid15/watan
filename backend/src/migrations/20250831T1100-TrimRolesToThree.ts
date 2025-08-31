import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrimRolesToThree20250831T1100 implements MigrationInterface {
  name = 'TrimRolesToThree20250831T1100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users 
      SET role = 'instance_owner' 
      WHERE role IN ('admin', 'distributor', 'instance_owner')
    `);

    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role_transition');
    await queryRunner.query(`
      ALTER TABLE users 
      ADD CONSTRAINT chk_users_role_final 
      CHECK (role IN ('developer', 'instance_owner', 'user'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role_final');
    await queryRunner.query(`
      ALTER TABLE users 
      ADD CONSTRAINT chk_users_role_transition 
      CHECK (role IN ('developer','admin','user','instance_owner','distributor','tenant_owner','end_user'))
    `);
  }
}
