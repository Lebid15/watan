/**
 * compare-schema.ts
 * Compares entity metadata (runtime) vs schema_db.sql snapshot (Postgres). Generates SCHEMA_REPORT.md.
 * Requires a file `schema_db.sql` at repository root (../schema_db.sql relative to backend directory) unless overridden via --db.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../data-source';

type DbColumn = { name: string; rawType: string; nullable: boolean; default?: string | null };
type DbTable = { name: string; columns: Record<string, DbColumn>; raw?: string };

interface DiffIssue { category: string; table: string; detail: string; }

function parseSchemaSql(sql: string): Record<string, DbTable> {
  const tables: Record<string, DbTable> = {};
  const createRegex = /CREATE TABLE IF NOT EXISTS\s+"?([a-zA-Z0-9_]+)"?\s*\(([^;]+?)\);/gms;
  let m: RegExpExecArray | null;
  while ((m = createRegex.exec(sql))) {
    const table = m[1];
    const body = m[2];
    const lines = body.split(/,(?=(?:[^()]*\([^()]*\))*[^()]*$)/).map(l => l.trim()); // split top-level commas
    const tbl: DbTable = { name: table, columns: {}, raw: body };
    for (const line of lines) {
      if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY)/i.test(line)) continue;
      const colMatch = /^"?([a-zA-Z0-9_]+)"?\s+([^,]+)$/m.exec(line);
      if (!colMatch) continue;
      const colName = colMatch[1];
      const def = colMatch[2];
      const nullable = !/NOT NULL/i.test(def);
      let defaultVal: string | null = null;
      const defMatch = /DEFAULT\s+([^\s]+)/i.exec(def);
      if (defMatch) defaultVal = defMatch[1];
      tbl.columns[colName] = { name: colName, rawType: def.replace(/DEFAULT.+/i,'').trim(), nullable, default: defaultVal };
    }
    tables[table] = tbl;
  }
  return tables;
}

async function run() {
  const argIdx = process.argv.indexOf('--db');
  const schemaPath = argIdx !== -1 ? process.argv[argIdx+1] : path.resolve(process.cwd(), 'schema_db.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('[compare] schema file missing:', schemaPath);
  }
  const dbSql = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath,'utf8') : '';
  const dbTables = dbSql ? parseSchemaSql(dbSql) : {};

  await dataSource.initialize();
  const metas = dataSource.entityMetadatas;

  const issues: DiffIssue[] = [];
  const entityTables = new Set<string>();
  for (const m of metas) {
    const tName = m.tableName;
    entityTables.add(tName);
    const db = dbTables[tName];
    if (!db) {
      issues.push({ category: 'missing_table_in_db', table: tName, detail: 'Entity table not found in DB snapshot' });
      continue;
    }
    // columns present in entity but missing in DB
    for (const col of m.columns) {
      const colName = col.databaseName;
      const dbCol = db.columns[colName];
      if (!dbCol) {
        issues.push({ category: 'missing_column_in_db', table: tName, detail: colName });
        continue;
      }
      // basic type / nullability diff heuristic
      const entityNullable = col.isNullable;
      if (entityNullable !== dbCol.nullable) {
        issues.push({ category: 'nullable_mismatch', table: tName, detail: `${colName}: entity ${entityNullable} vs db ${dbCol.nullable}` });
      }
    }
    // columns extra in DB
    for (const dbColName of Object.keys(db.columns)) {
      if (!m.columns.find(c => c.databaseName === dbColName)) {
        issues.push({ category: 'extra_column_in_db', table: tName, detail: dbColName });
      }
    }
  }
  // tables extra in DB snapshot
  for (const dbTbl of Object.keys(dbTables)) {
    if (!entityTables.has(dbTbl)) {
      issues.push({ category: 'extra_table_in_db', table: dbTbl, detail: 'No entity mapping' });
    }
  }

  const reportPath = path.resolve(process.cwd(), 'SCHEMA_REPORT.md');
  const lines: string[] = [];
  lines.push('# Schema Report');
  lines.push('Generated at: ' + new Date().toISOString());
  if (!dbSql) {
    lines.push('\n**WARNING:** schema_db.sql not found. Only entity structure listed; DB comparison skipped.');
  }
  lines.push('\n## Entity Tables');
  for (const m of metas) {
    lines.push(`\n### Table: ${m.tableName}`);
    lines.push('| Column | Type | Nullable | Primary | Generated | Default |');
    lines.push('|--------|------|----------|---------|-----------|---------|');
    for (const c of m.columns) {
      lines.push(`| ${c.databaseName} | ${(c.type as any)?.name || c.type} | ${c.isNullable} | ${c.isPrimary} | ${c.isGenerated} | ${c.default ?? ''} |`);
    }
    if (m.indices.length) {
      lines.push('\nIndexes:');
      for (const i of m.indices) {
        lines.push(`- ${i.name} (${i.isUnique ? 'UNIQUE' : 'IDX'}): ${i.columns.map(cc => cc.databaseName).join(', ')}`);
      }
    }
    if (m.foreignKeys.length) {
      lines.push('\nForeign Keys:');
      for (const fk of m.foreignKeys) {
        lines.push(`- ${fk.name || '(unnamed)'}: [${fk.columns.map(c=>c.databaseName).join(', ')}] -> ${fk.referencedEntityMetadata.tableName}([${fk.referencedColumns.map(c=>c.databaseName).join(', ')}])`);
      }
    }
  }
  lines.push('\n## Differences');
  if (!issues.length) {
    lines.push(dbSql ? '\nNo differences detected.' : '\n(DB snapshot missing – differences not computed).');
  } else {
    lines.push('| Category | Table | Detail |');
    lines.push('|----------|-------|--------|');
    for (const d of issues) {
      lines.push(`| ${d.category} | ${d.table} | ${d.detail} |`);
    }
  }

  // Simplistic migration suggestions
  if (issues.length) {
    lines.push('\n## Suggested Migration Actions');
    const missingCols = issues.filter(i=>i.category==='missing_column_in_db');
    if (missingCols.length) {
      lines.push('### Add Missing Columns');
      for (const mc of missingCols) {
        lines.push(`- ALTER TABLE "${mc.table}" ADD COLUMN ... (${mc.detail})`);
      }
    }
    const missingTables = issues.filter(i=>i.category==='missing_table_in_db');
    if (missingTables.length) {
      lines.push('### Create Missing Tables');
      for (const mt of missingTables) lines.push(`- CREATE TABLE "${mt.table}" (...)`);
    }
    const extraCols = issues.filter(i=>i.category==='extra_column_in_db');
    if (extraCols.length) {
      lines.push('### Extra Columns (evaluate, then drop if obsolete)');
      for (const ec of extraCols) lines.push(`- (Review) ALTER TABLE "${ec.table}" DROP COLUMN "${ec.detail}";`);
    }
  }

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log('Report written:', reportPath);
  if (issues.length) {
    console.log(JSON.stringify({ issues }, null, 2));
  }
  await dataSource.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
