import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase2: جداول تسعير الموزّع (NULLABLE / بدون NOT NULL صارمة الآن)
export class DistributorPricingTables20250827T1450 implements MigrationInterface {
  name = 'DistributorPricingTables20250827T1450';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "distributor_price_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid,
        "distributorUserId" uuid,
        "name" varchar(160),
        "isActive" boolean DEFAULT true,
        "createdAt" timestamptz DEFAULT now(),
        "updatedAt" timestamptz DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dist_price_groups_name" ON "distributor_price_groups" ("tenantId","distributorUserId","name")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "distributor_user_price_groups" (
        "distributorPriceGroupId" uuid,
        "userId" uuid,
        "createdAt" timestamptz DEFAULT now(),
        UNIQUE("distributorPriceGroupId","userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "distributor_package_prices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid,
        "distributorUserId" uuid,
        "packageId" uuid,
        "distributorPriceGroupId" uuid,
        "priceUSD" DECIMAL(18,6) DEFAULT 0,
        "createdAt" timestamptz DEFAULT now(),
        "updatedAt" timestamptz DEFAULT now(),
        UNIQUE("distributorUserId","distributorPriceGroupId","packageId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "distributor_package_prices"');
    await queryRunner.query('DROP TABLE IF EXISTS "distributor_user_price_groups"');
    await queryRunner.query('DROP TABLE IF EXISTS "distributor_price_groups"');
  }
}
