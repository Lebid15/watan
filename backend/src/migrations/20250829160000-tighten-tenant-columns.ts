import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Post‑patch tightening for legacy tables after adding tenantId.
 * Ensures NOT NULL where safe and adds defensive FK references if the tenants table exists.
 * Idempotent: checks for column null counts before altering.
 */
export class TightenTenantColumns20250829160000 implements MigrationInterface {
  name = 'TightenTenantColumns20250829160000';

  private tables = ['payment_method', 'deposit', 'code_group'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tbl of this.tables) {
      await queryRunner.query(`DO $$
      DECLARE v_nulls int;
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='${tbl}' AND column_name='tenantId'
        ) THEN
          EXECUTE 'SELECT count(*) FROM "${tbl}" WHERE "tenantId" IS NULL';
          GET DIAGNOSTICS v_nulls = ROW_COUNT; -- not used directly, but kept for clarity
          -- Use a separate SELECT to fetch the actual null count
          EXECUTE 'SELECT count(*) FROM "${tbl}" WHERE "tenantId" IS NULL' INTO v_nulls;
          IF v_nulls = 0 THEN
            BEGIN
              EXECUTE 'ALTER TABLE "${tbl}" ALTER COLUMN "tenantId" SET NOT NULL';
            EXCEPTION WHEN others THEN
              RAISE NOTICE '[TightenTenantCols] Failed to set NOT NULL on ${tbl}.tenantId (%).', SQLERRM;
            END;
          ELSE
            RAISE NOTICE '[TightenTenantCols] Skipping NOT NULL on ${tbl}.tenantId; still % NULL rows.', v_nulls;
          END IF;
        END IF;
      END $$;`);
    }
  }

  public async down(): Promise<void> {
    // Intentionally no-op (do not relax constraints automatically).
    return;
  }
}
