import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientApiRequestLogsTenantIdx20250905T1400 implements MigrationInterface {
  name = 'ClientApiRequestLogsTenantIdx20250905T1400';
  public async up(q: QueryRunner): Promise<void> {
    // Guard: skip if base table does not exist (fresh DB missing earlier migration?)
    const exists = await q.query(`SELECT 1 FROM information_schema.tables WHERE table_name='client_api_request_logs' LIMIT 1`);
    if (!exists || !exists.length) {
      console.log('[Migration][ClientApiRequestLogsTenantIdx] table missing -> skip index creation');
      return;
    }
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_tenant_created" ON "client_api_request_logs" ("tenantId","createdAt")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_client_api_logs_tenant_created"`);
  }
}
