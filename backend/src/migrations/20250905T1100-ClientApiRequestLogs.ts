import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientApiRequestLogs20250905T1100 implements MigrationInterface {
  name = 'ClientApiRequestLogs20250905T1100';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "client_api_request_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "tenantId" uuid NOT NULL,
      "method" varchar(60) NOT NULL,
      "path" varchar(200) NOT NULL,
      "ip" varchar(64),
      "code" int NOT NULL,
      "createdAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
    )`);
  await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_user" ON "client_api_request_logs" ("userId")`);
  await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_user_created" ON "client_api_request_logs" ("userId","createdAt")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "client_api_request_logs"`);
  }
}
