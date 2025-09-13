import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupportsCounterToProduct20250913T1600 implements MigrationInterface {
  name = 'AddSupportsCounterToProduct20250913T1600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product ADD COLUMN IF NOT EXISTS "supportsCounter" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product DROP COLUMN IF EXISTS "supportsCounter"`);
  }
}
