import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue baseline for missing price_groups and package_prices tables.
 */
export class CreatePriceGroupsAndPackagePricesBaseline20250825T0200 implements MigrationInterface {
  name = 'CreatePriceGroupsAndPackagePricesBaseline20250825T0200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      -- price_groups
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='price_groups') THEN
          CREATE TABLE "price_groups" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "name" varchar NOT NULL,
            "isActive" boolean NOT NULL DEFAULT true
          );
          RAISE NOTICE 'Rescue: created table price_groups';
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_price_groups_tenant" ON "price_groups" ("tenantId");
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ux_price_groups_name_tenant') THEN
          EXECUTE 'CREATE UNIQUE INDEX "ux_price_groups_name_tenant" ON "price_groups" ("tenantId","name")';
        END IF;
      END$$;

      -- package_prices
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='package_prices') THEN
          CREATE TABLE "package_prices" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "price" numeric(10,2) NOT NULL DEFAULT 0,
            "package_id" uuid NULL,
            "price_group_id" uuid NULL
          );
          RAISE NOTICE 'Rescue: created table package_prices';
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_package_prices_tenant" ON "package_prices" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_package_prices_package_id" ON "package_prices" ("package_id");
      CREATE INDEX IF NOT EXISTS "idx_package_prices_group_id" ON "package_prices" ("price_group_id");
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname='UQ_package_prices_tenant_pkg_grp'
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX "UQ_package_prices_tenant_pkg_grp" ON "package_prices" ("tenantId","package_id","price_group_id") WHERE package_id IS NOT NULL AND price_group_id IS NOT NULL';
        END IF;
      END$$;
    `);

    // Add foreign keys if missing
    await queryRunner.query(`
      DO $$
      BEGIN
        -- FK package_prices.package_id -> product_packages.id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='package_prices' AND constraint_name='fk_package_prices_package_id'
        ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_packages') THEN
          BEGIN
            ALTER TABLE "package_prices" ADD CONSTRAINT "fk_package_prices_package_id" FOREIGN KEY ("package_id") REFERENCES "product_packages"("id") ON DELETE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
        -- FK package_prices.price_group_id -> price_groups.id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='package_prices' AND constraint_name='fk_package_prices_group_id'
        ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='price_groups') THEN
          BEGIN
            ALTER TABLE "package_prices" ADD CONSTRAINT "fk_package_prices_group_id" FOREIGN KEY ("price_group_id") REFERENCES "price_groups"("id") ON DELETE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
      END$$;
    `);
  }

  public async down(): Promise<void> {
    // لا حذف (إنقاذ فقط)
  }
}
