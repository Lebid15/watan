import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Align package_mappings table with current entity (tenantId + meta jsonb).
 * Fixes runtime error: column PackageMapping.tenantId does not exist
 */
export class AddTenantIdToPackageMappings20250830T2310 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add tenantId (nullable first for backfill)
    const hasTenantId = await queryRunner.hasColumn('package_mappings', 'tenantId');
    if (!hasTenantId) {
      await queryRunner.addColumn(
        'package_mappings',
        new TableColumn({ name: 'tenantId', type: 'uuid', isNullable: true }),
      );
    }

    // 2) Add meta column if missing
    const hasMeta = await queryRunner.hasColumn('package_mappings', 'meta');
    if (!hasMeta) {
      await queryRunner.addColumn(
        'package_mappings',
        new TableColumn({ name: 'meta', type: 'jsonb', isNullable: true }),
      );
    }

    // 3) Backfill tenantId using integrations table (id -> tenantId)
    // Integrations table column assumed "tenantId" (camel case) per existing entities/migrations.
    // Backfill: only rows where provider_api_id looks like a UUID, then cast to uuid for join
    await queryRunner.query(
      `UPDATE package_mappings pm
       SET "tenantId" = i."tenantId"
       FROM integrations i
       WHERE pm.provider_api_id ~ '^[0-9a-fA-F-]{36}$'
         AND pm.provider_api_id::uuid = i.id
         AND pm."tenantId" IS NULL`,
    );

    // 4) Enforce NOT NULL (only if column exists and no remaining nulls)
    if (!hasTenantId) {
      await queryRunner.changeColumn(
        'package_mappings',
        'tenantId',
        new TableColumn({ name: 'tenantId', type: 'uuid', isNullable: false }),
      );
    } else {
      // If it existed but nullable, attempt to tighten
      const remaining = await queryRunner.query(
        `SELECT COUNT(*) AS cnt FROM package_mappings WHERE "tenantId" IS NULL`,
      );
      const cnt = Number(remaining?.[0]?.cnt || 0);
      if (cnt === 0) {
        await queryRunner.changeColumn(
          'package_mappings',
          'tenantId',
          new TableColumn({ name: 'tenantId', type: 'uuid', isNullable: false }),
        );
      }
    }

    // 5) Indexes
    const existingIdxRows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'package_mappings'`,
    );
    const haveIdxTenantApi = existingIdxRows.some((r) => r.indexname === 'idx_package_mappings_tenant_api');
    const haveIdxTenantPackage = existingIdxRows.some((r) => r.indexname === 'idx_package_mappings_tenant_package');

    if (!haveIdxTenantApi) {
      await queryRunner.createIndex(
        'package_mappings',
        new TableIndex({ name: 'idx_package_mappings_tenant_api', columnNames: ['tenantId', 'provider_api_id'] }),
      );
    }
    if (!haveIdxTenantPackage) {
      await queryRunner.createIndex(
        'package_mappings',
        new TableIndex({ name: 'idx_package_mappings_tenant_package', columnNames: ['tenantId', 'our_package_id'] }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new indexes (ignore if absent)
    try {
      await queryRunner.dropIndex('package_mappings', 'idx_package_mappings_tenant_api');
    } catch {}
    try {
      await queryRunner.dropIndex('package_mappings', 'idx_package_mappings_tenant_package');
    } catch {}
    // Drop columns (safe to ignore failures)
    try {
      await queryRunner.dropColumn('package_mappings', 'meta');
    } catch {}
    try {
      await queryRunner.dropColumn('package_mappings', 'tenantId');
    } catch {}
  }
}
