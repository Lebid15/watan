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
    // Ensure tenant table exists (safe no-op if present)
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
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          );
        END IF;
      END$$;
    `);

    // Insert missing tenants referenced by users.tenantId
    await queryRunner.query(`
      INSERT INTO "tenant" (id, name, code, isActive, createdAt, updatedAt)
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
        );
    `);

    // Insert missing tenants referenced by product_orders.tenantId (legacy rows)
    await queryRunner.query(`
      INSERT INTO "tenant" (id, name, code, isActive, createdAt, updatedAt)
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
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Do not delete tenants; safe no-op.
  }
}
