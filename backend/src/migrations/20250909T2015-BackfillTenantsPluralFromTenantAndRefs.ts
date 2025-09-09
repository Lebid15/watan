import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BackfillTenantsPluralFromTenantAndRefs
 * Some environments still have FK pointing to table "tenants" (plural). To prevent FK violations during
 * order creation, this migration ensures the "tenants" table exists and contains rows for all ids present in
 * the canonical "tenant" table and any referenced tenantIds in users/product_orders.
 */
export class BackfillTenantsPluralFromTenantAndRefs20250909T2015 implements MigrationInterface {
  name = 'BackfillTenantsPluralFromTenantAndRefs20250909T2015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure "tenants" table exists with minimal columns (snake_case timestamps)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='tenants'
        ) THEN
          CREATE TABLE "tenants" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" varchar NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
          );
        END IF;
      END$$;
    `);

    // Add snake_case timestamp columns if missing on existing installs
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
    `);

    // If legacy camelCase columns exist on tenants, backfill snake_case from them safely
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='createdAt'
        ) THEN
          EXECUTE 'UPDATE "tenants" SET "created_at" = COALESCE("created_at", "createdAt", now()) WHERE "created_at" IS NULL';
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='updatedAt'
        ) THEN
          EXECUTE 'UPDATE "tenants" SET "updated_at" = COALESCE("updated_at", "updatedAt", now()) WHERE "updated_at" IS NULL';
        END IF;
      END$$;
    `);

    // Copy rows from canonical "tenant" into "tenants" when missing
    // Choose safest timestamp sources depending on available columns (camelCase or snake_case) on tenant table
    await queryRunner.query(`
      DO $$
      DECLARE
        has_camel_created boolean := EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='createdAt'
        );
        has_snake_created boolean := EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='created_at'
        );
        has_camel_updated boolean := EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='updatedAt'
        );
        has_snake_updated boolean := EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='updated_at'
        );
        created_expr text;
        updated_expr text;
      BEGIN
        IF has_camel_created THEN
          created_expr := 'COALESCE(t."createdAt", now())';
        ELSIF has_snake_created THEN
          created_expr := 'COALESCE(t.created_at, now())';
        ELSE
          created_expr := 'now()';
        END IF;

        IF has_camel_updated THEN
          updated_expr := 'COALESCE(t."updatedAt", now())';
        ELSIF has_snake_updated THEN
          updated_expr := 'COALESCE(t.updated_at, now())';
        ELSE
          updated_expr := 'now()';
        END IF;

        EXECUTE format($f$
          INSERT INTO "tenants" (id, name, created_at, updated_at)
          SELECT t.id, t.name, %s, %s
          FROM "tenant" t
          WHERE NOT EXISTS (
            SELECT 1 FROM "tenants" x WHERE x.id = t.id
          )
        $f$, created_expr, updated_expr);
      END$$;
    `);

    // Insert missing tenants referenced by users.tenantId
    await queryRunner.query(`
      INSERT INTO "tenants" (id, name, created_at, updated_at)
      SELECT DISTINCT u."tenantId" AS id,
             CONCAT('Tenant ', SUBSTRING(u."tenantId"::text, 1, 8)) AS name,
             now(), now()
      FROM "users" u
      WHERE u."tenantId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tenants" tx WHERE tx.id = u."tenantId"
        );
    `);

    // Insert missing tenants referenced by product_orders.tenantId
    await queryRunner.query(`
      INSERT INTO "tenants" (id, name, created_at, updated_at)
      SELECT DISTINCT o."tenantId" AS id,
             CONCAT('Tenant ', SUBSTRING(o."tenantId"::text, 1, 8)) AS name,
             now(), now()
      FROM "product_orders" o
      WHERE o."tenantId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tenants" tx WHERE tx.id = o."tenantId"
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive; no down action.
  }
}
