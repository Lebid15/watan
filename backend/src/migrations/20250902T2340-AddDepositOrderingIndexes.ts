import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds composite indexes to optimize deposit listing queries ordered by approval/create time.
 */
export class AddDepositOrderingIndexes20250902T2340 implements MigrationInterface {
  name = 'AddDepositOrderingIndexes20250902T2340';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const depositTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='deposit'
    `);
    
    if (depositTableExists.length === 0) {
      console.log('AddDepositOrderingIndexes: deposit table does not exist, skipping migration');
      return;
    }

    const hasUserId = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='user_id'
    `);
    const hasApprovedAt = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='approvedAt'
    `);
    const hasTenantId = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='tenantId'
    `);

    if (hasUserId.length === 0 || hasApprovedAt.length === 0 || hasTenantId.length === 0) {
      console.log('AddDepositOrderingIndexes: deposit table missing required columns (user_id, approvedAt, tenantId), skipping migration');
      return;
    }

    const driver = (queryRunner.connection as any).options.type;
    if (driver === 'sqlite') {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposit_user_time ON deposit (user_id, approvedAt DESC, createdAt DESC, id DESC);`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposit_tenant_time ON deposit (tenantId, approvedAt DESC, createdAt DESC, id DESC);`);
      // Also create aliases matching spec wording (plural & camelCase) if desired (SQLite keeps separate index namespace)
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposits_user_time ON deposit (user_id, approvedAt DESC, createdAt DESC, id DESC);`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_deposits_tenant_time ON deposit (tenantId, approvedAt DESC, createdAt DESC, id DESC);`);
    } else {
      await queryRunner.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_deposit_user_time') THEN
          CREATE INDEX idx_deposit_user_time ON deposit (user_id, approvedAt DESC, createdAt DESC, id DESC);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_deposit_tenant_time') THEN
          CREATE INDEX idx_deposit_tenant_time ON deposit (tenantId, approvedAt DESC, createdAt DESC, id DESC);
        END IF;
        -- Aliases using requested names (plural deposits + camel userId)
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_deposits_user_time') THEN
          CREATE INDEX idx_deposits_user_time ON deposit (user_id, approvedAt DESC, createdAt DESC, id DESC);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_deposits_tenant_time') THEN
          CREATE INDEX idx_deposits_tenant_time ON deposit (tenantId, approvedAt DESC, createdAt DESC, id DESC);
        END IF;
      END$$;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection as any).options.type;
    if (driver === 'sqlite') {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposit_user_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposit_tenant_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposits_user_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposits_tenant_time;`);
    } else {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposit_user_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposit_tenant_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposits_user_time;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_deposits_tenant_time;`);
    }
  }
}
