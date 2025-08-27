#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'src', 'migrations');

function listMigrations(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(ts|js)$/.test(f)).map(f => path.join(dir, f));
}

const files = listMigrations(MIG_DIR);
let violations = [];

const patterns = [
  {
    id: 'FK_PLURAL_TENANTS',
    regex: /referencedTableName:\s*['"]tenants['"]/g,
    message: "Use singular 'tenant' for referencedTableName"
  },
  {
    id: 'BILLING_ANCHOR_UNQUOTED_CHECK',
    regex: /billingAnchor\s+IN\s*\('EOM','DOM'\)/g,
    message: 'Quote camelCase column in CHECK: use "billingAnchor" IN (...)'
  }
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const p of patterns) {
    if (p.regex.test(content)) {
      violations.push({ file: path.relative(ROOT, file), rule: p.id, detail: p.message });
    }
  }
}

if (violations.length) {
  console.error('\nMigration guard FAILED:');
  for (const v of violations) {
    console.error(` - [${v.rule}] ${v.file}: ${v.detail}`);
  }
  console.error('\nFix the above before deploying.');
  process.exit(1);
} else {
  console.log('✅ Migration guard passed (no forbidden patterns).');
}
