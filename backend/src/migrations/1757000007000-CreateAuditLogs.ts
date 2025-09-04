import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1757000007000 implements MigrationInterface {
  name = 'CreateAuditLogs1757000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventType" varchar(60) NOT NULL,
        "actorUserId" uuid NULL,
        "targetUserId" uuid NULL,
        "targetTenantId" uuid NULL,
        "ip" varchar(45) NULL,
        "userAgent" varchar(200) NULL,
        "meta" jsonb NULL,
        "createdAt" TIMESTAMPTZ DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_event" ON "audit_logs" ("eventType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_actor" ON "audit_logs" ("actorUserId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_tenant" ON "audit_logs" ("targetTenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
