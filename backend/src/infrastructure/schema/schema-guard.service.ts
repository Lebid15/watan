import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * SchemaGuardService
 * Lightweight runtime verification that required tables / columns exist.
 * It NEVER throws (to avoid taking the API down). It only logs warnings / info.
 * Use it to surface drift that would otherwise appear later as 42703 errors.
 */
@Injectable()
export class SchemaGuardService {
  constructor(private readonly dataSource: DataSource) {}

  /** Tables with the columns we expect to be present (additive only). */
  private readonly expectations: Record<string, string[]> = {
    users: ['tenantId', 'email', 'role'],
    product_orders: ['tenantId'],
    product: ['tenantId'],
    product_packages: ['tenantId'],
    price_groups: ['tenantId'],
    package_prices: ['tenantId'],
    package_costs: ['tenantId'],
    order_dispatch_logs: ['tenantId'],
    integrations: ['tenantId', 'scope'],
    currencies: ['tenantId', 'code'],
    tenant: ['code', 'name'],
    tenant_domain: ['tenantId', 'domain', 'type'],
    catalog_product: ['tenantId', 'name'],
    catalog_package: ['tenantId', 'catalogProductId'],
  };

  async verify(): Promise<void> {
    const ds = this.dataSource;
    console.log('🔍 [SchemaGuard] Verifying required columns...');
    try {
      const results: any[] = [];
      for (const [table, cols] of Object.entries(this.expectations)) {
        // Does table exist?
        const [{ exists: tableExists }] = await ds.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
          [table],
        );
        if (!tableExists) {
          results.push({ table, missing: '<<TABLE MISSING>>' });
          console.warn(`⚠️ [SchemaGuard] Table missing: ${table}`);
          continue;
        }
        const presentColsRows = await ds.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [table],
        );
        const presentSet = new Set(presentColsRows.map((r: any) => r.column_name));
        const missingCols = cols.filter((c) => !presentSet.has(c));
        if (missingCols.length) {
          results.push({ table, missing: missingCols.join(',') });
          console.warn(`⚠️ [SchemaGuard] Missing columns in ${table}: ${missingCols.join(', ')}`);
        }
      }
      if (!results.length) {
        console.log('✅ [SchemaGuard] All required columns present.');
      } else {
        console.log('⚠️ [SchemaGuard] Drift summary:', results);
      }
    } catch (err: any) {
      console.warn('⚠️ [SchemaGuard] Verification failed:', err?.message || err);
    }
  }
}
