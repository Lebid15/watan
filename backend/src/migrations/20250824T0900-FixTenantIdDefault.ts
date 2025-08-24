import { MigrationInterface, QueryRunner } from 'typeorm';

// Fix: ensure tenant.id has a UUID default in production where the table was created without one.
export class FixTenantIdDefault20250824T0900 implements MigrationInterface {
  name = 'FixTenantIdDefault20250824T0900';

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
  DO $$
  DECLARE v text; has_table bool;
  BEGIN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    EXCEPTION WHEN others THEN END;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='tenant'
    ) INTO has_table;

    IF NOT has_table THEN
      EXECUTE 'CREATE TABLE "tenant" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )';
      RAISE NOTICE 'Rescue: created tenant table.';
    END IF;

    SELECT column_default INTO v
    FROM information_schema.columns
    WHERE table_name='tenant' AND column_name='id';

    IF v IS NULL OR length(trim(coalesce(v,''))) = 0 THEN
      EXECUTE 'ALTER TABLE "tenant" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()';
    END IF;
  END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to no default (safe; existing rows keep their UUIDs)
    await queryRunner.query('ALTER TABLE "tenant" ALTER COLUMN "id" DROP DEFAULT');
  }
}
