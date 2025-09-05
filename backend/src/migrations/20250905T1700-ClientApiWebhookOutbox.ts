import { MigrationInterface, QueryRunner } from 'typeorm';

// v1.2 Webhook dispatch outbox
export class ClientApiWebhookOutbox20250905T1700 implements MigrationInterface {
  name = 'ClientApiWebhookOutbox20250905T1700';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "client_api_webhook_outbox" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "event_type" varchar(64) NOT NULL,
      "delivery_url" varchar(600) NOT NULL,
      "payload_json" ${process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb'} NOT NULL,
      "headers_json" ${process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb'} NULL,
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      "attempt_count" int NOT NULL DEFAULT 0,
      "next_attempt_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NULL,
      "last_error" text NULL,
      "response_code" int NULL,
      "created_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now(),
      "updated_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
    );`);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_next" ON "client_api_webhook_outbox" ("status", "next_attempt_at");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_tenant" ON "client_api_webhook_outbox" ("tenantId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_user" ON "client_api_webhook_outbox" ("userId");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "client_api_webhook_outbox"`);
  }
}
