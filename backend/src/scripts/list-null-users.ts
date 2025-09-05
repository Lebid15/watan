import dataSource from '../data-source';

/**
 * Quick helper to list users that still have NULL tenantId (debug / ops)
 */
async function main() {
  await dataSource.initialize();
  const rows = await dataSource.query('SELECT id, email, "createdAt" FROM users WHERE "tenantId" IS NULL ORDER BY "createdAt" ASC');
  if (!rows.length) {
    console.log('No NULL tenantId users.');
  } else {
    console.log(`${rows.length} NULL tenantId users:`);
    for (const r of rows) {
      console.log(`${r.id}\t${r.email}\t${r.createdAt}`);
    }
  }
  await dataSource.destroy();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
