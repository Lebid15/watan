import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ensures tenant integrity:
 * - FK users.tenantId -> tenant.id ON DELETE SET NULL (if column & table exist)
 * - FK tenant_domain.tenantId -> tenant.id ON DELETE CASCADE
 * - UNIQUE(domain) already exists (guarded)
 * - Partial uniqueness: only one primary domain per tenant (unique where "isPrimary"=true)
 */
export class TenantIntegrity20250905T2215 implements MigrationInterface {
  name = 'TenantIntegrity20250905T2215'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Wrap operations defensively
    // users.tenantId FK
    await queryRunner.query(`DO $$
    DECLARE r RECORD;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenantId') THEN
        FOR r IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='users' AND column_name='tenantId' LOOP
          BEGIN
            EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT %I', r.constraint_name);
          EXCEPTION WHEN others THEN NULL; END;
        END LOOP;
        BEGIN
          ALTER TABLE "users" ADD CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
      END IF;
    END$$;`);

    // tenant_domain.tenantId FK cascade
    await queryRunner.query(`DO $$
    DECLARE r RECORD;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_domain' AND column_name='tenantId') THEN
        FOR r IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='tenant_domain' AND column_name='tenantId' LOOP
          BEGIN
            EXECUTE format('ALTER TABLE "tenant_domain" DROP CONSTRAINT %I', r.constraint_name);
          EXCEPTION WHEN others THEN NULL; END;
        END LOOP;
        BEGIN
          ALTER TABLE "tenant_domain" ADD CONSTRAINT "fk_tenant_domain_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
      END IF;
    END$$;`);

    // unique primary per tenant (partial index)
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uniq_tenant_domain_primary_one') THEN
  CREATE UNIQUE INDEX uniq_tenant_domain_primary_one ON tenant_domain ("tenantId") WHERE "isPrimary" = true;
      END IF;
    END$$;`);
  }

  public async down(): Promise<void> {
    // Intentionally left non-reversible for safety.
  }
}
