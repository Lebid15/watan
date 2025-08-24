import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue baseline for missing "product" table (production lacked it causing runtime errors 42P01).
 * Creates minimal schema matching product.entity.ts and essential indexes / unique constraint.
 */
export class CreateProductBaseline20250825T0100 implements MigrationInterface {
  name = 'CreateProductBaseline20250825T0100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'product'
        ) THEN
          CREATE TABLE "product" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "name" varchar NOT NULL,
            "description" text NULL,
            "imageUrl" varchar NULL,
            "isActive" boolean NOT NULL DEFAULT true
          );
          RAISE NOTICE 'Rescue: created table product';
        END IF;
      END$$;
      -- Indexes / constraints (idempotent)
      CREATE INDEX IF NOT EXISTS "idx_product_tenantId" ON "product" ("tenantId");
      DO $$
      BEGIN
        -- Unique (tenantId, name)
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'UQ_product_tenant_name'
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX "UQ_product_tenant_name" ON "product" ("tenantId","name")';
        END IF;
      END$$;
    `);

    // Ensure foreign key from product_packages.product_id -> product.id if both exist and FK missing
    await queryRunner.query(`
      DO $$
      DECLARE fk_exists bool;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='product_packages' AND tc.constraint_name='fk_product_packages_product_id'
        ) INTO fk_exists;
        IF NOT fk_exists AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_packages' AND column_name='product_id') THEN
          BEGIN
            ALTER TABLE "product_packages"
              ADD CONSTRAINT "fk_product_packages_product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;
            RAISE NOTICE 'Rescue: added FK product_packages.product_id -> product.id';
          EXCEPTION WHEN duplicate_object THEN
            NULL; -- race-safe
          END;
        END IF;
      END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non destructive rollback (do nothing). Drop manually if ever needed.
  }
}
