import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdempotencyKeys20250828T1020 implements MigrationInterface {
  name = 'CreateIdempotencyKeys20250828T1020';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "idempotency_keys" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tokenId" uuid NOT NULL,
      "key" varchar(80) NOT NULL,
      "requestHash" varchar(128) NOT NULL,
      "orderId" uuid NULL,
      "createdAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now(),
      "ttlSeconds" int NOT NULL DEFAULT 86400
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_token_key" ON "idempotency_keys" ("tokenId","key")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_idempotency_token" ON "idempotency_keys" ("tokenId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
  }
}
