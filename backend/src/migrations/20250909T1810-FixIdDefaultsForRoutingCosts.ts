import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensure id defaults for routing-related tables so inserts don't fail with NOT NULL on id.
 * Adds gen_random_uuid() default where missing.
 */
export class FixIdDefaultsForRoutingCosts20250909T1810 implements MigrationInterface {
  name = 'FixIdDefaultsForRoutingCosts20250909T1810';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    // package_routing
    await queryRunner.query(`ALTER TABLE "package_routing" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`);
    await queryRunner.query(`UPDATE "package_routing" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
    // package_costs
    await queryRunner.query(`ALTER TABLE "package_costs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`);
    await queryRunner.query(`UPDATE "package_costs" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
    // order_dispatch_logs
    await queryRunner.query(`ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`);
    await queryRunner.query(`UPDATE "order_dispatch_logs" SET "id" = gen_random_uuid() WHERE "id" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop defaults (keep any populated ids)
    await queryRunner.query(`ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "package_costs" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "package_routing" ALTER COLUMN "id" DROP DEFAULT`);
  }
}
