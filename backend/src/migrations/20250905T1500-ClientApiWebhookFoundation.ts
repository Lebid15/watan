import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientApiWebhookFoundation20250905T1500 implements MigrationInterface {
  name = 'ClientApiWebhookFoundation20250905T1500';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiWebhookEnabled" boolean DEFAULT false`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiWebhookSigVersion" varchar(8) DEFAULT 'v1'`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiWebhookSecret" varchar(120)`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiWebhookLastRotatedAt" timestamptz`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiWebhookEnabled"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiWebhookSigVersion"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiWebhookSecret"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiWebhookLastRotatedAt"`);
  }
}
