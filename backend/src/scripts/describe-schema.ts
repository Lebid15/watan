/**
 * describe-schema.ts
 * Introspects TypeORM entity metadata and outputs JSON describing tables, columns, indexes, FKs.
 * Usage: npm run schema:describe (writes entity_schema.json) OR
 *        ts-node -r tsconfig-paths/register src/scripts/describe-schema.ts --out entity_schema.json
 */
import 'reflect-metadata';
import * as fs from 'fs';
import dataSource from '../data-source';

interface EntityDescription {
  tableName: string;
  columns: Array<{
    propertyName: string;
    databaseName: string;
    type: string | any;
    isNullable: boolean;
    isPrimary: boolean;
    isGenerated: boolean;
    length?: string;
    default?: any;
  enumValues?: any[];
  }>; 
  indexes: Array<{
    name: string;
    columns: string[];
    isUnique: boolean;
  }>;
  foreignKeys: Array<{
    name: string | undefined;
    columnNames: string[];
    referencedTable: string;
    referencedColumns: string[];
    onDelete?: string | null;
  }>;
}

async function run() {
  const outIdx = process.argv.indexOf('--out');
  const outFile = outIdx !== -1 ? process.argv[outIdx + 1] : null;
  await dataSource.initialize();
  const metas = dataSource.entityMetadatas;
  const result: EntityDescription[] = metas.map(m => ({
    tableName: m.tableName,
    columns: m.columns.map(c => {
      let enumVals: any[] | undefined = undefined;
      // TypeORM 0.3.x stores enum info in c.enum? or c.enumName; optional chaining
      const anyCol: any = c as any;
      if (Array.isArray(anyCol.enum)) enumVals = anyCol.enum;
      return ({
      propertyName: c.propertyName,
      databaseName: c.databaseName,
      type: (c.type as any)?.name || c.type,
      isNullable: c.isNullable,
      isPrimary: c.isPrimary,
      isGenerated: c.isGenerated,
      length: c.length,
      default: typeof c.default === 'function' ? 'FUNC' : c.default,
      enumValues: enumVals,
    }); }),
    indexes: m.indices.map(i => ({ name: i.name, columns: i.columns.map(col => col.databaseName), isUnique: i.isUnique })),
    foreignKeys: m.foreignKeys.map(fk => ({
      name: fk.name,
      columnNames: fk.columns.map(c => c.databaseName),
      referencedTable: fk.referencedEntityMetadata.tableName,
      referencedColumns: fk.referencedColumns.map(c => c.databaseName),
      onDelete: fk.onDelete,
    })),
  }));
  const json = JSON.stringify({ generatedAt: new Date().toISOString(), entities: result }, null, 2);
  if (outFile) {
    fs.writeFileSync(outFile, json, 'utf8');
    console.log('Wrote entity schema to', outFile);
  } else {
    console.log(json);
  }
  await dataSource.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
