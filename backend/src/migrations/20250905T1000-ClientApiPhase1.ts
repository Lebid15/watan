import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase1 client API: add user columns + orderUuid + unique index */
export class ClientApiPhase120250905T1000 implements MigrationInterface {
  name = 'ClientApiPhase120250905T1000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiToken" varchar(40)`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiTokenRevoked" boolean NULL DEFAULT false`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiAllowAllIps" boolean NULL DEFAULT true`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiAllowIps" ${process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb'} NULL ${process.env.TEST_DB_SQLITE === 'true' ? '' : 'DEFAULT \'[]\''}`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiWebhookUrl" varchar(300)`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiLastUsedAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'}`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_users_apiToken" ON "users" ("apiToken")`);

    await q.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "orderUuid" varchar(64)`);
    // composite uniqueness (tenantId,userId,orderUuid) ignoring NULL orderUuid
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_tenant_user_orderUuid" ON "product_orders" ("tenantId","userId","orderUuid") WHERE "orderUuid" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_orders_tenant_user_orderUuid"`);
    await q.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "orderUuid"`);
    await q.query(`DROP INDEX IF EXISTS "idx_users_apiToken"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiLastUsedAt"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiWebhookUrl"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiAllowIps"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiAllowAllIps"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiTokenRevoked"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiToken"`);
  }
}
