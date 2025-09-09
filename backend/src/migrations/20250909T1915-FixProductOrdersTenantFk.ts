import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FixProductOrdersTenantFk
 * Some environments created a wrong FK to table "tenants" (plural) due to an early rescue migration.
 * The canonical table is "tenant" (singular). This migration drops the wrong FK (if present)
 * and re-creates it referencing "tenant"("id"). Also fixes users.tenantId FK if it points to "tenants".
 */
export class FixProductOrdersTenantFk20250909T1915 implements MigrationInterface {
  name = 'FixProductOrdersTenantFk20250909T1915';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto is available for other migrations (safe no-op here)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Switch product_orders.tenantId FK to "tenant"("id")
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Drop existing FK if any (old rescue might have pointed to tenants.id)
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name='product_orders' AND constraint_name='fk_product_orders_tenant'
        ) THEN
          BEGIN
            EXECUTE 'ALTER TABLE "product_orders" DROP CONSTRAINT "fk_product_orders_tenant"';
          EXCEPTION WHEN others THEN NULL; END;
        END IF;

        -- Add correct FK referencing canonical table "tenant"
        BEGIN
          EXECUTE 'ALTER TABLE "product_orders" ADD CONSTRAINT "fk_product_orders_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT';
        EXCEPTION WHEN others THEN NULL; END;
      END$$;
    `);

    // Align users.tenantId FK too if legacy constraint exists pointing to tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name='users' AND constraint_name='fk_users_tenant'
        ) THEN
          BEGIN
            EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT "fk_users_tenant"';
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
        BEGIN
          EXECUTE 'ALTER TABLE "users" ADD CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE';
        EXCEPTION WHEN others THEN NULL; END;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort restore to prior state (not strictly necessary). Recreate FK to tenants if that table exists.
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          EXECUTE 'ALTER TABLE "product_orders" DROP CONSTRAINT IF EXISTS "fk_product_orders_tenant"';
        EXCEPTION WHEN others THEN NULL; END;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
          BEGIN
            EXECUTE 'ALTER TABLE "product_orders" ADD CONSTRAINT "fk_product_orders_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT';
          EXCEPTION WHEN others THEN NULL; END;
        END IF;

        BEGIN
          EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "fk_users_tenant"';
        EXCEPTION WHEN others THEN NULL; END;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
          BEGIN
            EXECUTE 'ALTER TABLE "users" ADD CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE';
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
      END$$;
    `);
  }
}
