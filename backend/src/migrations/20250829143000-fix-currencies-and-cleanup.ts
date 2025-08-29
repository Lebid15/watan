import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalizes the currencies table to match the Currency entity:
 *  - Ensures columns: name, rate, isActive, isPrimary, symbolAr, tenantId
 *  - Copies legacy columns (ratetousd -> rate, tenantid -> tenantId)
 *  - Adds indexes / unique constraint (tenantId, code)
 *  - Drops obsolete legacy columns (ratetousd, tenantid) if safe
 */
export class FixCurrenciesAndCleanup20250829143000 implements MigrationInterface {
  name = 'FixCurrenciesAndCleanup20250829143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns if missing
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "name" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "rate" numeric(10,4) DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "isPrimary" boolean DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "symbolAr" varchar(20)`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);

    // Copy tenantid -> tenantId if legacy column present and new column nulls
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='tenantid') THEN
        UPDATE "currencies" SET "tenantId" = "tenantid" WHERE "tenantId" IS NULL AND "tenantid" IS NOT NULL;
      END IF;
    END $$;`);

    // Copy legacy ratetousd to rate if present
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='ratetousd') THEN
        UPDATE "currencies" SET "rate" = "ratetousd" WHERE ("rate" IS NULL OR "rate"=1) AND "ratetousd" IS NOT NULL;
      END IF;
    END $$;`);

    // Backfill name with code where null
    await queryRunner.query(`UPDATE "currencies" SET "name" = "code" WHERE "name" IS NULL`);

    // Indexes / constraints
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_currencies_tenant" ON "currencies" ("tenantId")`);
    await queryRunner.query(`DO $$ BEGIN
      -- Create unique composite if not already existing (name can differ but (tenantId, code) must be unique)
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_currencies_tenant_code'
      ) THEN
        CREATE UNIQUE INDEX "uniq_currencies_tenant_code" ON "currencies" ("tenantId", "code");
      END IF;
    END $$;`);

    // Drop obsolete legacy columns (safe after copy). Keep guarded so it doesn't fail if already removed.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='ratetousd') THEN
        ALTER TABLE "currencies" DROP COLUMN "ratetousd";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='tenantid') THEN
        ALTER TABLE "currencies" DROP COLUMN "tenantid";
      END IF;
    END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Attempt to recreate legacy columns (best-effort) – data loss for dropped columns is acceptable.
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "tenantid" uuid`);
    await queryRunner.query(`ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "ratetousd" numeric(18,6)`);
    // Copy back if tenantid empty
    await queryRunner.query(`UPDATE "currencies" SET "tenantid" = "tenantId" WHERE "tenantid" IS NULL AND "tenantId" IS NOT NULL`);
    await queryRunner.query(`UPDATE "currencies" SET "ratetousd" = "rate" WHERE "ratetousd" IS NULL AND "rate" IS NOT NULL`);
    // (We do not drop new columns in down to avoid breaking current entity expectations.)
  }
}
