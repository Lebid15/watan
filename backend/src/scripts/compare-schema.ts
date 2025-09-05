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
  // Support pg_dump variants:
  // CREATE TABLE public.table_name (
  // CREATE TABLE ONLY public.table_name (
  // CREATE TABLE IF NOT EXISTS public.table_name (
  // Quoted identifiers also possible: CREATE TABLE "public"."MyTable" (
  const createRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:ONLY\s+)?((?:"[^"]+"|[a-zA-Z0-9_]+)(?:\.(?:"[^"]+"|[a-zA-Z0-9_]+))?)\s*\(([^;]+?)\);/gms;
  let m: RegExpExecArray | null;
  while ((m = createRegex.exec(sql))) {
    let rawName = m[1];
    const body = m[2];
    // Normalize schema-qualified name -> take last segment, strip quotes
    if (rawName.includes('.')) rawName = rawName.split('.').pop() || rawName;
    const table = rawName.replace(/"/g, '');
    const lines = body.split(/,(?=(?:[^()]*\([^()]*\))*[^()]*$)/).map(l => l.trim());
    const tbl: DbTable = { name: table, columns: {}, raw: body };
    for (const line of lines) {
      if (!line) continue;
      if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK|EXCLUDE)/i.test(line)) continue;
      const colMatch = /^"?([a-zA-Z0-9_]+)"?\s+(.+)$/m.exec(line);
      if (!colMatch) continue;
      const colName = colMatch[1];
      const def = colMatch[2].replace(/,$/, '').trim();
      // Skip pseudo columns or table-level options
      if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY)/i.test(def)) continue;
      const nullable = !/NOT NULL/i.test(def);
      let defaultVal: string | null = null;
      const defMatch = /DEFAULT\s+([^\s,]+)/i.exec(def);
      if (defMatch) defaultVal = defMatch[1];
      const rawType = def
        .replace(/DEFAULT\s+[^\s,]+/i, '')
        .replace(/NOT NULL/i, '')
        .trim();
      tbl.columns[colName] = { name: colName, rawType, nullable, default: defaultVal };
    }
    tables[table] = tbl;
  }
  // Post-pass: capture ALTER TABLE ADD COLUMN statements created after initial table creation
  const addColRegex = /ALTER TABLE ONLY\s+((?:"[^"]+"|[a-zA-Z0-9_]+)\.(?:"[^"]+"|[a-zA-Z0-9_]+))\s+ADD COLUMN\s+((?:IF NOT EXISTS\s+)?"?[a-zA-Z0-9_]+"?\s+[^;]+?);/gms;
  let a: RegExpExecArray | null;
  while ((a = addColRegex.exec(sql))) {
    let fq = a[1];
    let defLine = a[2].trim().replace(/IF NOT EXISTS\s+/i,'');
    const table = fq.split('.').pop()!.replace(/"/g,'');
    const colMatch = /^"?([a-zA-Z0-9_]+)"?\s+(.+);?$/m.exec(defLine);
    if (!colMatch) continue;
    const colName = colMatch[1];
    const def = colMatch[2].trim();
    const nullable = !/NOT NULL/i.test(def);
    const defMatch = /DEFAULT\s+([^\s,]+)/i.exec(def);
    const defaultVal = defMatch ? defMatch[1] : null;
    const rawType = def
      .replace(/DEFAULT\s+[^\s,]+/i, '')
      .replace(/NOT NULL/i, '')
      .trim();
    if (!tables[table]) tables[table] = { name: table, columns: {} };
    if (!tables[table].columns[colName]) {
      tables[table].columns[colName] = { name: colName, rawType, nullable, default: defaultVal };
    }
  }
  // Apply NOT NULL / DROP NOT NULL alterations
  const nnRegex = /ALTER TABLE ONLY\s+((?:"[^"]+"|[a-zA-Z0-9_]+)\.(?:"[^"]+"|[a-zA-Z0-9_]+))\s+ALTER COLUMN\s+"?([a-zA-Z0-9_]+)"?\s+SET NOT NULL;/g;
  while ((a = nnRegex.exec(sql))) {
    const table = a[1].split('.').pop()!.replace(/"/g,'');
    const col = a[2];
    if (tables[table] && tables[table].columns[col]) {
      tables[table].columns[col].nullable = false;
    }
  }
  const dropNnRegex = /ALTER TABLE ONLY\s+((?:"[^"]+"|[a-zA-Z0-9_]+)\.(?:"[^"]+"|[a-zA-Z0-9_]+))\s+ALTER COLUMN\s+"?([a-zA-Z0-9_]+)"?\s+DROP NOT NULL;/g;
  while ((a = dropNnRegex.exec(sql))) {
    const table = a[1].split('.').pop()!.replace(/"/g,'');
    const col = a[2];
    if (tables[table] && tables[table].columns[col]) {
      tables[table].columns[col].nullable = true;
    }
  }
  return tables;
}

async function run() {
  // Determine schema snapshot path. Priority:
  // 1. --db <path>
  // 2. ./schema_db.sql (cwd)
  // 3. ./backend/schema_db.sql (when running from repo root)
  // 4. ../backend/schema_db.sql (when running from backend/ subdir inside mono repo root)
  // 5. ../schema_db.sql (legacy location at repo root)
  const argIdx = process.argv.indexOf('--db');
  let explicit: string | undefined = argIdx !== -1 ? path.resolve(process.cwd(), process.argv[argIdx+1]) : undefined;
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  const cwd = process.cwd();
  candidates.push(path.resolve(cwd, 'schema_db.sql'));
  candidates.push(path.resolve(cwd, 'backend', 'schema_db.sql'));
  candidates.push(path.resolve(cwd, '..', 'backend', 'schema_db.sql'));
  candidates.push(path.resolve(cwd, '..', 'schema_db.sql'));
  const schemaPath = candidates.find(p => fs.existsSync(p));
  if (!schemaPath) {
    console.error('[compare] schema file missing. Tried:');
    for (const c of candidates) console.error(' -', c);
  } else {
    console.log('[compare] Using schema snapshot:', schemaPath.replace(cwd + path.sep, ''));
  }
  const dbSql = schemaPath ? fs.readFileSync(schemaPath,'utf8') : '';
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
  console.log(`[compare] Parsed ${Object.keys(dbTables).length} tables from snapshot.`);
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
  // Deduplicate issues (in case of duplicate entity metadata edge cases)
  const seen = new Set<string>();
  const dedup: DiffIssue[] = [];
  for (const i of issues) {
    const key = `${i.category}|${i.table}|${i.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(i);
  }
  issues.length = 0;
  issues.push(...dedup);

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
