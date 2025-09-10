import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensure id defaults for routing-related tables so inserts don't fail with NOT NULL on id.
 * Adds gen_random_uuid() default where missing.
 */
export class FixIdDefaultsForRoutingCosts20250909T1810 implements MigrationInterface {
  name = 'FixIdDefaultsForRoutingCosts20250909T1810';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    // package_routing (only if table exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.package_routing') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "package_routing" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()';
          EXECUTE 'UPDATE "package_routing" SET "id" = gen_random_uuid() WHERE "id" IS NULL';
        END IF;
      END $$;
    `);
    // package_costs (only if table exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.package_costs') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "package_costs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()';
          EXECUTE 'UPDATE "package_costs" SET "id" = gen_random_uuid() WHERE "id" IS NULL';
        END IF;
      END $$;
    `);
    // order_dispatch_logs (only if table exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.order_dispatch_logs') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()';
          EXECUTE 'UPDATE "order_dispatch_logs" SET "id" = gen_random_uuid() WHERE "id" IS NULL';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop defaults if tables exist (keep any populated ids)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.order_dispatch_logs') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" DROP DEFAULT';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.package_costs') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "package_costs" ALTER COLUMN "id" DROP DEFAULT';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.package_routing') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "package_routing" ALTER COLUMN "id" DROP DEFAULT';
        END IF;
      END $$;
    `);
  }
}
