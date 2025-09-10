import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduce soft-delete columns (deletedAt) and adjust uniqueness to apply only to active rows.
 * - tenant: add deletedAt, drop legacy unique constraints on (code), create partial unique on (code) WHERE deletedAt IS NULL
 * - tenant_domain: add deletedAt, drop legacy unique on (domain), create partial unique on (domain) WHERE deletedAt IS NULL
 */
export class TenantSoftDeleteAndUnique20250910T1100 implements MigrationInterface {
  name = 'TenantSoftDeleteAndUnique20250910T1100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure columns exist
  await queryRunner.query(`ALTER TABLE "tenant" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`);
  await queryRunner.query(`ALTER TABLE "tenant_domain" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`);

    // Drop any unique constraints on tenant(code)
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        -- Drop unique constraints that exclusively target column "code" on table tenant
        FOR r IN (
          SELECT c.conname, n.nspname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE t.relname = 'tenant' AND c.contype = 'u'
            AND (
              SELECT array_agg(a.attname::text ORDER BY a.attnum)
              FROM unnest(c.conkey) AS k(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ) = ARRAY['code']::text[]

              SELECT array_agg(a.attname ORDER BY a.attnum)
              FROM unnest(c.conkey) AS k(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ) = ARRAY['code']
        ) LOOP
          EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
        END LOOP;
        -- Drop known unique indexes by name if they exist
  BEGIN EXECUTE 'DROP INDEX IF EXISTS "UQ_tenant_code"'; EXCEPTION WHEN undefined_object THEN END;
  BEGIN EXECUTE 'DROP INDEX IF EXISTS "idx_tenant_code_unique"'; EXCEPTION WHEN undefined_object THEN END;
      END $$;
    `);

    // Drop any unique constraints on tenant_domain(domain)
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT c.conname, n.nspname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE t.relname = 'tenant_domain' AND c.contype = 'u'
            AND (
              SELECT array_agg(a.attname::text ORDER BY a.attnum)
              FROM unnest(c.conkey) AS k(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ) = ARRAY['domain']::text[]

              SELECT array_agg(a.attname ORDER BY a.attnum)
              FROM unnest(c.conkey) AS k(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ) = ARRAY['domain']
        ) LOOP
          EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
        END LOOP;
    BEGIN EXECUTE 'DROP INDEX IF EXISTS "UQ_tenant_domain_domain"'; EXCEPTION WHEN undefined_object THEN END;
    BEGIN EXECUTE 'DROP INDEX IF EXISTS "tenant_domain_domain_idx"'; EXCEPTION WHEN undefined_object THEN END;
    BEGIN EXECUTE 'DROP INDEX IF EXISTS "ux_tenant_domain_domain"'; EXCEPTION WHEN undefined_object THEN END;
      END $$;
    `);

    // Create partial unique indexes restricted to non-deleted rows
  await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_code_active" ON "tenant" ("code") WHERE "deleted_at" IS NULL`);
  await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_domain_active" ON "tenant_domain" ("domain") WHERE "deleted_at" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the partial unique indexes
  await queryRunner.query(`DROP INDEX IF EXISTS "uq_tenant_domain_active"`);
  await queryRunner.query(`DROP INDEX IF EXISTS "uq_tenant_code_active"`);

    // Recreate legacy unique indexes (non-partial)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_code" ON "tenant" ("code")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_domain_domain" ON "tenant_domain" ("domain")`);

    // Optionally drop columns (keep data if exists)
  await queryRunner.query(`ALTER TABLE "tenant_domain" DROP COLUMN IF EXISTS "deleted_at"`);
  await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN IF EXISTS "deleted_at"`);
  }
}
