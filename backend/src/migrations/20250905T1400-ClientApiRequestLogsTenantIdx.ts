import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientApiRequestLogsTenantIdx20250905T1400 implements MigrationInterface {
  name = 'ClientApiRequestLogsTenantIdx20250905T1400';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_tenant_created" ON "client_api_request_logs" ("tenantId","createdAt")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_client_api_logs_tenant_created"`);
  }
}
