import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds composite unique index to enforce idempotency per tenant+orderUuid (orderUuid nullable)
// Uses partial index (Postgres) to exclude NULL orderUuid rows.
export class AddUniqueOrderUuidIndex1694100100000 implements MigrationInterface {
  name = 'AddUniqueOrderUuidIndex1694100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_tenant_order_uuid_notnull ON "product_orders" ("tenantId", "orderUuid") WHERE "orderUuid" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_orders_tenant_order_uuid_notnull`);
  }
}
