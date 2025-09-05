import { MigrationInterface, QueryRunner } from "typeorm";

export class ClientApiPhase2StatsRateLimit20250905T1300 implements MigrationInterface {
    name = 'ClientApiPhase2StatsRateLimit20250905T1300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apiRateLimitPerMin" integer NULL`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "client_api_stats_daily" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "tenantId" uuid NOT NULL,
            "date" date NOT NULL,
            "total" int NOT NULL DEFAULT 0,
            "ok" int NOT NULL DEFAULT 0,
            "err_1xx" int NOT NULL DEFAULT 0,
            "err_5xx" int NOT NULL DEFAULT 0,
            "code_100" int NOT NULL DEFAULT 0,
            "code_105" int NOT NULL DEFAULT 0,
            "code_106" int NOT NULL DEFAULT 0,
            "code_109" int NOT NULL DEFAULT 0,
            "code_110" int NOT NULL DEFAULT 0,
            "code_112" int NOT NULL DEFAULT 0,
            "code_113" int NOT NULL DEFAULT 0,
            "code_114" int NOT NULL DEFAULT 0,
            "code_120" int NOT NULL DEFAULT 0,
            "code_121" int NOT NULL DEFAULT 0,
            "code_122" int NOT NULL DEFAULT 0,
            "code_123" int NOT NULL DEFAULT 0,
            "code_130" int NOT NULL DEFAULT 0,
            "code_429" int NOT NULL DEFAULT 0,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        );`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_api_stats_daily_tenant_date" ON "client_api_stats_daily" ("tenantId","date")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "client_api_stats_daily"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "apiRateLimitPerMin"`);
    }
}
