import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensure (idempotent) baseline columns exist on deposit table, especially missing `note`.
 * Some environments created the table manually without the column then added it by hand.
 * This migration defensively adds any missing baseline columns matching the current entity:
 *   tenantId, user_id, method_id (nullable), originalAmount, originalCurrency, walletCurrency,
 *   rateUsed, convertedAmount, note, status, source, createdAt, approvedAt
 */
export class EnsureDepositNoteColumn20250905T1800 implements MigrationInterface {
  name = 'EnsureDepositNoteColumn20250905T1800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Detect driver (sqlite vs postgres)
    const driver = (queryRunner.connection as any).options.type;

    // Helper: Postgres add column if missing
    async function pgAdd(table: string, column: string, ddl: string) {
      await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}') THEN ALTER TABLE "${table}" ADD COLUMN ${ddl}; END IF; END $$;`);
    }

    // Helper: sqlite add column if missing
    async function sqliteAdd(table: string, column: string, ddl: string) {
      const cols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info('${table}')`);
      if (!cols.some(c => c.name === column)) {
        await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN ${ddl};`);
      }
    }

    // Check table exists
    if (driver === 'sqlite') {
      // In sqlite we assume table exists if pragma returns rows; if not, do nothing (created by earlier migration sequence)
      const tables: Array<{ name: string }> = await queryRunner.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='deposit';`);
      if (tables.length === 0) return; // nothing to do
      // Columns (types simplified for sqlite):
      await sqliteAdd('deposit', 'tenantId', 'varchar');
      await sqliteAdd('deposit', 'method_id', 'varchar'); // ensure exists even if earlier DDL missed it
      await sqliteAdd('deposit', 'originalAmount', 'numeric');
      await sqliteAdd('deposit', 'originalCurrency', 'varchar');
      await sqliteAdd('deposit', 'walletCurrency', 'varchar');
      await sqliteAdd('deposit', 'rateUsed', 'numeric');
      await sqliteAdd('deposit', 'convertedAmount', 'numeric');
      await sqliteAdd('deposit', 'note', 'text');
      await sqliteAdd('deposit', 'status', 'varchar');
      await sqliteAdd('deposit', 'source', 'varchar');
      await sqliteAdd('deposit', 'createdAt', 'datetime');
      await sqliteAdd('deposit', 'approvedAt', 'datetime');
      return;
    }

    // Postgres (or other) path
    const tableExists = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_name='deposit'`);
    if (tableExists.length === 0) {
      // Table will be created by earlier migration (AddPayments). If migration order broke, we don't recreate here.
      return;
    }

    // Ensure enum types (defensive in case earlier migrations were skipped)
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='deposit_status_enum' AND n.nspname='public') THEN CREATE TYPE "public"."deposit_status_enum" AS ENUM ('pending','approved','rejected'); END IF; END $$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='deposit_source_enum' AND n.nspname='public') THEN CREATE TYPE "public"."deposit_source_enum" AS ENUM ('user_request','admin_topup'); END IF; END $$;`);

    // Add columns if missing (types must match entity / latest model)
    await pgAdd('deposit', 'tenantId', '"tenantId" uuid');
    await pgAdd('deposit', 'user_id', '"user_id" uuid');
    await pgAdd('deposit', 'method_id', '"method_id" uuid');
    await pgAdd('deposit', 'originalAmount', '"originalAmount" numeric(18,6) NOT NULL DEFAULT 0');
    await pgAdd('deposit', 'originalCurrency', `"originalCurrency" varchar(10)`); // keep simple; service layer enforces value
    await pgAdd('deposit', 'walletCurrency', `"walletCurrency" varchar(10)`);
    await pgAdd('deposit', 'rateUsed', '"rateUsed" numeric(18,6) NOT NULL DEFAULT 0');
    await pgAdd('deposit', 'convertedAmount', '"convertedAmount" numeric(18,6) NOT NULL DEFAULT 0');
    await pgAdd('deposit', 'note', '"note" text');
  await pgAdd('deposit', 'status', '"status" "public"."deposit_status_enum"');
  await pgAdd('deposit', 'source', '"source" "public"."deposit_source_enum"');
    await pgAdd('deposit', 'createdAt', '"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()');
    await pgAdd('deposit', 'approvedAt', '"approvedAt" TIMESTAMP WITH TIME ZONE NULL');

    // Indexes (idempotent)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_user" ON "deposit" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_method" ON "deposit" ("method_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_status" ON "deposit" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_createdAt" ON "deposit" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant" ON "deposit" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant_status_created" ON "deposit" ("tenantId","status","createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // We do NOT drop columns to avoid data loss; only drop indexes that were added here.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_tenant_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_method"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_user"`);
  }
}
