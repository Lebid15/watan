import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration steps:
 * 1. Attempt to backfill users with NULL tenantId by inferring from their email domain or leave for report.
 *    (Here: we will try match email domain part to tenant_domain.domain if exact match; otherwise remain NULL for report.)
 * 2. Report any remaining NULL users.
 * 3. Enforce NOT NULL and add FK with ON DELETE RESTRICT.
 */
export class FixUserTenantId20250906T0000 implements MigrationInterface {
  name = 'FixUserTenantId20250906T0000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Try inference via email domain exact match tenant_domain.domain
    await queryRunner.query(`
      WITH candidates AS (
        SELECT u.id as uid, td."tenantId" as inferred
        FROM users u
        JOIN tenant_domain td ON LOWER(split_part(u.email, '@', 2)) = LOWER(td.domain)
        WHERE u."tenantId" IS NULL
      )
      UPDATE users u SET "tenantId" = c.inferred
      FROM candidates c
      WHERE u.id = c.uid;
    `);

    // 2. Count remaining NULLs BEFORE constraint
    const remaining: Array<{ count: string }>= await queryRunner.query(`SELECT COUNT(*)::text as count FROM users WHERE "tenantId" IS NULL`);
    const remainingCount = parseInt(remaining[0]?.count || '0', 10);
    if (remainingCount > 0) {
      console.log(`[MIGRATION] WARNING: ${remainingCount} users still have NULL tenantId after inference.`);
      // Depending on policy we could fail here. We'll proceed but log; tenant:verify will catch if any slip through.
    }

    // 3. Add NOT NULL constraint: first ensure no nulls or abort
    if (remainingCount === 0) {
      // drop existing FK if any (defensive)
      await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
            ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
          END IF;
        END $$;`);

      // Alter column to NOT NULL
      await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" SET NOT NULL;`);

      // Add FK ON DELETE RESTRICT
      await queryRunner.query(`ALTER TABLE users
        ADD CONSTRAINT fk_users_tenant FOREIGN KEY ("tenantId") REFERENCES tenant(id) ON DELETE RESTRICT;`);
    } else {
      console.log('[MIGRATION] Skipping NOT NULL enforcement due to remaining NULL users. Fix manually then rerun.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: drop FK, make column nullable again
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
          ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
        END IF;
      END $$;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" DROP NOT NULL;`);
  }
}
