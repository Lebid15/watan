import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantApiTokens20250828T1010 implements MigrationInterface {
  name = 'CreateTenantApiTokens20250828T1010';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "tenant_api_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "name" varchar(80) NULL,
      "tokenPrefix" varchar(8) NOT NULL,
      "tokenHash" varchar(128) NOT NULL,
      "scopes" text NOT NULL,
      "expiresAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NULL,
      "lastUsedAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NULL,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_api_tokens_tenant" ON "tenant_api_tokens" ("tenantId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_api_tokens_user" ON "tenant_api_tokens" ("userId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_api_tokens_prefix" ON "tenant_api_tokens" ("tokenPrefix")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_api_tokens_active_exp" ON "tenant_api_tokens" ("isActive","expiresAt")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "tenant_api_tokens"`);
  }
}
