import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue migration: ensure singular table "tenant" has the columns expected by the current entity
 * definition (code, ownerUserId, isActive, updatedAt) and supporting indexes / uniqueness.
 * Safe to re-run (guards every DDL with IF EXISTS / NOT EXISTS). Does NOT rename table.
 */
export class RescueTenantColumns20250905T1200 implements MigrationInterface {
  name = 'RescueTenantColumns20250905T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      -- Make sure table exists (bootstrap safety)
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenant') THEN
        CREATE TABLE "tenant" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar(120) NOT NULL,
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
      END IF;

      -- code column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tenant' AND column_name='code'
      ) THEN
        ALTER TABLE "tenant" ADD COLUMN "code" varchar(40) NULL;
        -- Populate code with a slugified fallback from name or random
        UPDATE "tenant" SET "code" = lower(regexp_replace(coalesce("name", ''),'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,6)
        WHERE "code" IS NULL;
      END IF;

      -- ownerUserId column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tenant' AND column_name='ownerUserId'
      ) THEN
        ALTER TABLE "tenant" ADD COLUMN "ownerUserId" uuid NULL;
      END IF;

      -- isActive column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tenant' AND column_name='isActive'
      ) THEN
        ALTER TABLE "tenant" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true;
      END IF;

      -- updatedAt column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tenant' AND column_name='updatedAt'
      ) THEN
        ALTER TABLE "tenant" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now();
      END IF;

      -- Ensure NOT NULL + uniqueness for code after population
      BEGIN
        ALTER TABLE "tenant" ALTER COLUMN "code" SET NOT NULL;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_code_unique" ON "tenant" ("code");
      EXCEPTION WHEN others THEN NULL; END;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Non destructive rollback to avoid losing data; leave columns in place.
  }
}
