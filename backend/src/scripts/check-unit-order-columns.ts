import 'reflect-metadata';
import dataSource from '../data-source';

/*
  Read-only diagnostic script to verify presence of unit order pricing columns.
  Usage:
    npx ts-node -r tsconfig-paths/register src/scripts/check-unit-order-columns.ts
  Or after adding an npm script alias.
*/

async function main() {
  console.log('[check-unit-order-columns] Initializing data source...');
  await dataSource.initialize();
  const wanted = ['unitPriceApplied','sellPrice','cost','profit'];
  const rows = await dataSource.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='product_orders' AND column_name = ANY($1::text[]) ORDER BY 1`,
    [wanted]
  );
  const present = new Set(rows.map((r: any) => r.column_name));
  const missing = wanted.filter(c => !present.has(c));

  console.log('\n[check-unit-order-columns] Present columns:');
  if (present.size === 0) console.log('  (none of the expected columns found)');
  else wanted.forEach(c => {
    if (present.has(c)) console.log('  ✔', c);
  });

  if (missing.length) {
    console.log('\n[check-unit-order-columns] Missing columns:');
    missing.forEach(c => console.log('  ✖', c));
    console.log('\nResult: MISMATCH. Migration 20250913T1630-AddUnitFieldsToProductOrders needs to run.');
  } else {
    console.log('\nResult: OK. All expected columns are present.');
  }

  await dataSource.destroy();
}

main().catch(err => {
  console.error('[check-unit-order-columns] Error:', err);
  process.exit(1);
});
