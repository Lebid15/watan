import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BackfillMissingTenantsFromRefs
 * In some drifted environments, table "tenant" exists but is missing rows for existing users.tenantId or
 * legacy product_orders.tenantId values. This migration inserts placeholder tenants for any referenced
 * tenantId that does not yet exist in "tenant".
 */
export class BackfillMissingTenantsFromRefs20250909T1955 implements MigrationInterface {
  name = 'BackfillMissingTenantsFromRefs20250909T1955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure tenant table exists (safe no-op if present) with snake_case timestamps and is_active
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='tenant'
        ) THEN
          CREATE TABLE "tenant" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" varchar(120) NOT NULL,
            "code" varchar(40) NOT NULL UNIQUE,
            "ownerUserId" uuid NULL,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
          );
        END IF;
      END$$;
    `);

    // Add snake_case columns if missing (idempotent)
    await queryRunner.query(`
      ALTER TABLE "tenant" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
      ALTER TABLE "tenant" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
      ALTER TABLE "tenant" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
    `);

    // If legacy camelCase columns exist, backfill snake_case from them safely
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='isActive'
        ) THEN
          EXECUTE 'UPDATE "tenant" SET is_active = COALESCE(is_active, "isActive", true)';
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='createdAt'
        ) THEN
          EXECUTE 'UPDATE "tenant" SET created_at = COALESCE(created_at, "createdAt", now())';
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='updatedAt'
        ) THEN
          EXECUTE 'UPDATE "tenant" SET updated_at = COALESCE(updated_at, "updatedAt", now())';
        END IF;
      END$$;
    `);

    // Insert missing tenants referenced by users.tenantId
    await queryRunner.query(`
      INSERT INTO "tenant" (id, name, code, is_active, created_at, updated_at)
      SELECT DISTINCT u."tenantId" AS id,
             CONCAT('Tenant ', SUBSTRING(u."tenantId"::text, 1, 8)) AS name,
             CONCAT('t_', SUBSTRING(u."tenantId"::text, 1, 8)) AS code,
             true,
             now(),
             now()
      FROM "users" u
      WHERE u."tenantId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tenant" t WHERE t.id = u."tenantId"
        )
      ON CONFLICT (id) DO NOTHING;
    `);

    // Insert missing tenants referenced by product_orders.tenantId (legacy rows)
    await queryRunner.query(`
      INSERT INTO "tenant" (id, name, code, is_active, created_at, updated_at)
      SELECT DISTINCT o."tenantId" AS id,
             CONCAT('Tenant ', SUBSTRING(o."tenantId"::text, 1, 8)) AS name,
             CONCAT('t_', SUBSTRING(o."tenantId"::text, 1, 8)) AS code,
             true,
             now(),
             now()
      FROM "product_orders" o
      WHERE o."tenantId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tenant" t WHERE t.id = o."tenantId"
        )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Do not delete tenants; safe no-op.
  }
}
