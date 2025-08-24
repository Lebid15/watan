import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue migration: ensure tenant_domain table matches entity (adds missing columns like type, isPrimary, isVerified, updatedAt, widens domain length, unique index, FK).
 */
export class EnsureTenantDomainColumnsBaseline20250825T1210 implements MigrationInterface {
  name = 'EnsureTenantDomainColumnsBaseline20250825T1210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    DO $$
    DECLARE has_table bool; v_len int; v_type_col bool; v_isprim bool; v_isver bool; v_upd bool; v_domain_idx bool; v_fk bool; cur_type_default text; 
    BEGIN
      BEGIN CREATE EXTENSION IF NOT EXISTS "pgcrypto"; EXCEPTION WHEN others THEN END;

      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenant_domain') INTO has_table;

      IF NOT has_table THEN
        EXECUTE 'CREATE TABLE "tenant_domain" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "tenantId" uuid NULL,
          "domain" varchar(190) NOT NULL,
          "type" varchar(20) NOT NULL DEFAULT ''subdomain'',
          "isPrimary" boolean NOT NULL DEFAULT false,
          "isVerified" boolean NOT NULL DEFAULT false,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now()
        )';
      ELSE
        -- Add missing columns
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='type') INTO v_type_col;
        IF NOT v_type_col THEN
          EXECUTE 'ALTER TABLE "tenant_domain" ADD COLUMN "type" varchar(20) NOT NULL DEFAULT ''subdomain''';
        END IF;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='isPrimary') INTO v_isprim;
        IF NOT v_isprim THEN
          EXECUTE 'ALTER TABLE "tenant_domain" ADD COLUMN "isPrimary" boolean NOT NULL DEFAULT false';
        END IF;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='isVerified') INTO v_isver;
        IF NOT v_isver THEN
          EXECUTE 'ALTER TABLE "tenant_domain" ADD COLUMN "isVerified" boolean NOT NULL DEFAULT false';
        END IF;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='updatedAt') INTO v_upd;
        IF NOT v_upd THEN
          EXECUTE 'ALTER TABLE "tenant_domain" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()';
        END IF;
        -- Widen domain length if needed (<190)
        SELECT character_maximum_length FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='domain' INTO v_len;
        IF v_len IS NOT NULL AND v_len < 190 THEN
          EXECUTE 'ALTER TABLE "tenant_domain" ALTER COLUMN "domain" TYPE varchar(190)';
        END IF;
        -- Ensure type default
        SELECT column_default FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='type' INTO cur_type_default;
        IF cur_type_default IS NULL OR position('subdomain' in cur_type_default)=0 THEN
          -- set default (ignore if cannot)
          BEGIN EXECUTE 'ALTER TABLE "tenant_domain" ALTER COLUMN "type" SET DEFAULT ''subdomain'''; EXCEPTION WHEN others THEN END; END IF;
        -- Backfill null type values
        BEGIN EXECUTE 'UPDATE "tenant_domain" SET "type"=''subdomain'' WHERE "type" IS NULL'; EXCEPTION WHEN others THEN END;
      END IF;

      -- Unique index on domain
      SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname=current_schema() AND indexname='tenant_domain_domain_idx') INTO v_domain_idx;
      IF NOT v_domain_idx THEN
        BEGIN EXECUTE 'CREATE UNIQUE INDEX "tenant_domain_domain_idx" ON "tenant_domain" ("domain")'; EXCEPTION WHEN duplicate_table OR duplicate_object THEN END;
      END IF;

      -- FK constraint tenantId -> tenants.id (cascade)
      SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_tenant_domain_tenant') INTO v_fk;
      IF NOT v_fk AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
        BEGIN EXECUTE 'ALTER TABLE "tenant_domain" ADD CONSTRAINT "fk_tenant_domain_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE'; EXCEPTION WHEN duplicate_object THEN END;
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Non destructive
  }
}
