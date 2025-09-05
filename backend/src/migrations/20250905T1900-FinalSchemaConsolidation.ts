import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FinalSchemaConsolidation
 *
 * Purpose: Guarantee (idempotently) that all critical columns & indexes required by current code
 * exist even if earlier migrations were skipped or a fresh database starts from an arbitrary point.
 * This DOES NOT drop/rename anything (zero destructive actions) – only additive & index creation.
 * Safe to re-run.
 */
export class FinalSchemaConsolidation20250905T1900 implements MigrationInterface {
  name = 'FinalSchemaConsolidation20250905T1900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection as any).options.type;
    if (driver !== 'postgres') {
      console.log('[FinalSchemaConsolidation] Non‑Postgres driver detected, skipping (logic targets Postgres).');
      return;
    }

    // helper add column if missing
    async function addColumnIfNotExists(table: string, column: string, definition: string) {
      await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}') THEN ALTER TABLE "${table}" ADD COLUMN ${definition}; END IF; END $$;`);
    }

    // ===== tenant (singular physical) =====
    await addColumnIfNotExists('tenant', 'code', '"code" varchar(40)');
    await addColumnIfNotExists('tenant', 'ownerUserId', '"ownerUserId" uuid');
    await addColumnIfNotExists('tenant', 'isActive', '"isActive" boolean DEFAULT true');
    await addColumnIfNotExists('tenant', 'createdAt', '"createdAt" TIMESTAMPTZ DEFAULT now()');
    await addColumnIfNotExists('tenant', 'updatedAt', '"updatedAt" TIMESTAMPTZ DEFAULT now()');
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_code" ON "tenant" ("code");`);

    // ===== tenant_domain =====
    await addColumnIfNotExists('tenant_domain', 'tenantId', '"tenantId" uuid');
    await addColumnIfNotExists('tenant_domain', 'domain', '"domain" varchar(190)');
    await addColumnIfNotExists('tenant_domain', 'type', '"type" varchar(20) DEFAULT ' + "'subdomain'" );
    await addColumnIfNotExists('tenant_domain', 'isPrimary', '"isPrimary" boolean DEFAULT false');
    await addColumnIfNotExists('tenant_domain', 'isVerified', '"isVerified" boolean DEFAULT false');
    await addColumnIfNotExists('tenant_domain', 'createdAt', '"createdAt" TIMESTAMPTZ DEFAULT now()');
    await addColumnIfNotExists('tenant_domain', 'updatedAt', '"updatedAt" TIMESTAMPTZ DEFAULT now()');
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_domain_domain" ON "tenant_domain" ("domain");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_tenant" ON "tenant_domain" ("tenantId");`);

    // ===== deposit =====
    // enums (repeat safe)
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='deposit_status_enum' AND n.nspname='public') THEN CREATE TYPE "public"."deposit_status_enum" AS ENUM ('pending','approved','rejected'); END IF; END $$;`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='deposit_source_enum' AND n.nspname='public') THEN CREATE TYPE "public"."deposit_source_enum" AS ENUM ('user_request','admin_topup'); END IF; END $$;`);
    await addColumnIfNotExists('deposit', 'tenantId', '"tenantId" uuid');
    await addColumnIfNotExists('deposit', 'user_id', '"user_id" uuid');
    await addColumnIfNotExists('deposit', 'method_id', '"method_id" uuid');
    await addColumnIfNotExists('deposit', 'originalAmount', '"originalAmount" numeric(18,6) DEFAULT 0');
    await addColumnIfNotExists('deposit', 'originalCurrency', '"originalCurrency" varchar(10)');
    await addColumnIfNotExists('deposit', 'walletCurrency', '"walletCurrency" varchar(10)');
    await addColumnIfNotExists('deposit', 'rateUsed', '"rateUsed" numeric(18,6) DEFAULT 0');
    await addColumnIfNotExists('deposit', 'convertedAmount', '"convertedAmount" numeric(18,6) DEFAULT 0');
    await addColumnIfNotExists('deposit', 'note', '"note" text');
    await addColumnIfNotExists('deposit', 'status', '"status" "public"."deposit_status_enum" DEFAULT ' + "'pending'" );
    await addColumnIfNotExists('deposit', 'source', '"source" "public"."deposit_source_enum" DEFAULT ' + "'user_request'" );
    await addColumnIfNotExists('deposit', 'createdAt', '"createdAt" TIMESTAMPTZ DEFAULT now()');
    await addColumnIfNotExists('deposit', 'approvedAt', '"approvedAt" TIMESTAMPTZ');
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant_status_created_final" ON "deposit" ("tenantId","status","createdAt");`);

    // ===== users (only critical additions – most columns already covered by earlier migrations) =====
    await addColumnIfNotExists('users', 'apiEnabled', '"apiEnabled" boolean DEFAULT false');
    await addColumnIfNotExists('users', 'apiToken', '"apiToken" varchar(40)');
    await addColumnIfNotExists('users', 'apiTokenRevoked', '"apiTokenRevoked" boolean DEFAULT false');
    await addColumnIfNotExists('users', 'apiAllowAllIps', '"apiAllowAllIps" boolean DEFAULT true');
    await addColumnIfNotExists('users', 'apiWebhookEnabled', '"apiWebhookEnabled" boolean DEFAULT false');
    await addColumnIfNotExists('users', 'apiWebhookSigVersion', '"apiWebhookSigVersion" varchar(8) DEFAULT ' + "'v1'" );
    await addColumnIfNotExists('users', 'apiWebhookSecret', '"apiWebhookSecret" varchar(120)');

    // ===== site_settings (baseline) =====
    await addColumnIfNotExists('site_settings', 'tenantId', '"tenantId" uuid');
    await addColumnIfNotExists('site_settings', 'key', '"key" varchar(64)');
    await addColumnIfNotExists('site_settings', 'value', '"value" text');
    await addColumnIfNotExists('site_settings', 'createdAt', '"createdAt" TIMESTAMPTZ DEFAULT now()');
    await addColumnIfNotExists('site_settings', 'updatedAt', '"updatedAt" TIMESTAMPTZ DEFAULT now()');
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_site_settings_tenant_key" ON "site_settings" ("tenantId","key");`);

    // ===== currencies (ensure isPrimary, rate) =====
    await addColumnIfNotExists('currencies', 'isPrimary', '"isPrimary" boolean DEFAULT false');
    await addColumnIfNotExists('currencies', 'rate', '"rate" numeric(18,6) DEFAULT 1');

    // (Add any other last-minute safety columns here as needed)
  }

  public async down(): Promise<void> {
    // No rollback – purely additive safety net.
    console.log('[FinalSchemaConsolidation] down(): noop (non-destructive migration)');
  }
}
