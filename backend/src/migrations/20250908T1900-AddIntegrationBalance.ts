import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddIntegrationBalance20250908T1900
 * Adds a cached balance column to integrations so UI can display last fetched balance
 * instead of always showing 0. Idempotent (IF NOT EXISTS) and does not backfill.
 */
export class AddIntegrationBalance20250908T1900 implements MigrationInterface {
  name = 'AddIntegrationBalance20250908T1900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE integrations ADD COLUMN IF NOT EXISTS balance numeric(18,3)`
    );
    await queryRunner.query(
      `ALTER TABLE integrations ADD COLUMN IF NOT EXISTS "balanceUpdatedAt" timestamptz`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE integrations DROP COLUMN IF EXISTS "balanceUpdatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE integrations DROP COLUMN IF EXISTS balance`
    );
  }
}
