import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue migration: ensure all columns defined in user.entity.ts exist in the 'users' table.
 * Adds missing columns/indexes/constraints idempotently so runtime joins (e.g. user.phoneNumber) stop failing.
 */
export class EnsureUserColumnsBaseline20250825T0300 implements MigrationInterface {
  name = 'EnsureUserColumnsBaseline20250825T0300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
          RAISE NOTICE 'Rescue skipped (users table missing) — create baseline first';
          RETURN;
        END IF;

        -- Simple add column helper
        PERFORM 1;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenantId') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "tenantId" uuid NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='adminId') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "adminId" uuid NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='balance') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "balance" numeric(12,2) NOT NULL DEFAULT 0';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "role" varchar NOT NULL DEFAULT ''user''';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phoneNumber') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "phoneNumber" varchar NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='countryCode') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "countryCode" varchar NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='nationalId') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "nationalId" varchar NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "username" varchar NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='fullName') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "fullName" varchar NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='overdraftLimit') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "overdraftLimit" numeric(12,2) NOT NULL DEFAULT 0';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='price_group_id') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "price_group_id" uuid NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='currency_id') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "currency_id" uuid NULL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='emailVerified') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "emailVerified" boolean NOT NULL DEFAULT false';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='emailVerifiedAt') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" timestamptz NULL';
        END IF;

        -- createdAt / updatedAt timestamps if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='createdAt') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updatedAt') THEN
          EXECUTE 'ALTER TABLE "users" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()';
        END IF;

        -- Indexes / uniques
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_users_tenant') THEN
          EXECUTE 'CREATE INDEX "idx_users_tenant" ON "users" ("tenantId")';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uniq_users_tenant_email') THEN
          EXECUTE 'CREATE UNIQUE INDEX "uniq_users_tenant_email" ON "users" ("tenantId","email")';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uniq_users_tenant_username') THEN
          EXECUTE 'CREATE UNIQUE INDEX "uniq_users_tenant_username" ON "users" ("tenantId","username") WHERE username IS NOT NULL';
        END IF;

        -- Foreign keys (guarded)
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_users_admin') THEN
            EXECUTE 'ALTER TABLE "users" ADD CONSTRAINT "fk_users_admin" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL';
          END IF;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_users_price_group') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='price_groups') THEN
            EXECUTE 'ALTER TABLE "users" ADD CONSTRAINT "fk_users_price_group" FOREIGN KEY ("price_group_id") REFERENCES "price_groups"("id") ON DELETE SET NULL';
          END IF;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_users_currency') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='currencies') THEN
            EXECUTE 'ALTER TABLE "users" ADD CONSTRAINT "fk_users_currency" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL';
          END IF;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
      END$$;
    `);
  }

  public async down(): Promise<void> {
    // Non-destructive rollback (keep rescued columns)
  }
}
