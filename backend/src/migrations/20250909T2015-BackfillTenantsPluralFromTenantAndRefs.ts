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
    // Ensure "tenants" table exists with minimal columns
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='tenants'
        ) THEN
          CREATE TABLE "tenants" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" varchar NOT NULL,
            "createdAt" timestamptz DEFAULT now(),
            "updatedAt" timestamptz DEFAULT now()
          );
        END IF;
      END$$;
    `);

    // Copy rows from canonical "tenant" into "tenants" when missing
    await queryRunner.query(`
      INSERT INTO "tenants" (id, name, createdAt, updatedAt)
      SELECT t.id, t.name, COALESCE(t."createdAt", now()), COALESCE(t."updatedAt", now())
      FROM "tenant" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "tenants" x WHERE x.id = t.id
      );
    `);

    // Insert missing tenants referenced by users.tenantId
    await queryRunner.query(`
      INSERT INTO "tenants" (id, name, createdAt, updatedAt)
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
      INSERT INTO "tenants" (id, name, createdAt, updatedAt)
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
