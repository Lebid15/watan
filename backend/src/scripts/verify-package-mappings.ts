import dataSource from '../data-source';

(async () => {
  await dataSource.initialize();
  const q = (sql: string) => dataSource.query(sql);
  console.log('Checking package_mappings columns...');
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='package_mappings' ORDER BY 1`);
  console.table(cols);
  const sample = await q(`SELECT id, "tenantId", our_package_id, provider_api_id, provider_package_id FROM package_mappings LIMIT 5`)
    .catch(e => { console.error('Sample select error (maybe tenantId missing):', e.message); return []; });
  console.log('Sample rows:', sample);
  await dataSource.destroy();
})();
