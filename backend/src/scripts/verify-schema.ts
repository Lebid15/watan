/* verify-schema.ts
 * Verifies critical tables & columns exist. Exits 1 if anything missing.
 */
import 'reflect-metadata';
import dataSource from '../data-source';

type TableSpec = { table: string; columns: string[] };

const REQUIRED: TableSpec[] = [
  { table: 'tenant', columns: ['id','code','isActive','createdAt','updatedAt'] },
  { table: 'tenant_domain', columns: ['id','tenantId','domain','isPrimary','isVerified','createdAt','updatedAt'] },
  { table: 'users', columns: ['id','email','password','role','tenantId','apiEnabled'] },
  { table: 'deposit', columns: ['id','tenantId','user_id','originalAmount','note','status','source','createdAt'] },
  { table: 'site_settings', columns: ['id','tenantId','key','value'] },
  { table: 'currencies', columns: ['id','tenantId','code','rate','isPrimary'] },
];

async function run() {
  await dataSource.initialize();
  for (const spec of REQUIRED) {
    const hasTable = await dataSource.query(`SELECT 1 FROM information_schema.tables WHERE table_name='${spec.table}'`);
    if (hasTable.length === 0) {
      console.error(`[verify] Missing table: ${spec.table}`);
      process.exit(1);
    }
    const cols = await dataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${spec.table}'`);
    const existing = new Set(cols.map((r: any) => r.column_name));
    for (const c of spec.columns) {
      if (!existing.has(c)) {
        console.error(`[verify] Missing column ${spec.table}.${c}`);
        process.exit(1);
      }
    }
  }
  console.log('Schema OK');
  process.exit(0);
}

run().catch(e => { console.error('Verify failed', e); process.exit(1); });
