import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import 'dotenv/config';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

// Detect runtime mode
const runningTs = __filename.endsWith('.ts');
const explicitProd = process.env.NODE_ENV === 'production';
// Override flag to force dev behavior even if running from compiled JS
const forceDev = process.env.FORCE_DEV === 'true';
const isProd = !forceDev && (explicitProd || !runningTs);

// Always log flag states once (avoid noisy full env dump)
// eslint-disable-next-line no-console
console.log(
  `[DataSource] flags explicitProd=${explicitProd} runningTs=${runningTs} forceDev=${forceDev} isProd=${isProd}`
);

if (forceDev) {
  // eslint-disable-next-line no-console
  console.log('[DataSource] FORCE_DEV active -> using non-SSL dev connection variables.');
} else if (!explicitProd && !runningTs) {
  // eslint-disable-next-line no-console
  console.warn('[DataSource] NODE_ENV not production but running from dist -> using JS entity/migration globs.');
}

// Connection config
let baseConn: any;
if (isProd) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  let needSsl = true;
  try {
    const u = new URL(dbUrl);
    const params = new URLSearchParams(u.search);
    const sslMode = params.get('sslmode');
    const explicitDisable = ['disable', 'off', 'false', '0'].includes((sslMode || '').toLowerCase());
    if (['localhost', '127.0.0.1'].includes(u.hostname) || explicitDisable || process.env.DB_DISABLE_SSL === 'true') {
      needSsl = false;
    }
  } catch (_) {}
  baseConn = {
    type: 'postgres',
    url: dbUrl,
    ssl: needSsl ? { rejectUnauthorized: false } : false,
    extra: needSsl ? { ssl: { rejectUnauthorized: false } } : undefined,
  };
} else {
  // Prefer parsing DATABASE_URL if provided so CLI behavior matches Nest runtime config
  const url = process.env.DATABASE_URL;
  // eslint-disable-next-line no-console
  console.log('[DataSource] Dev branch: DATABASE_URL present?', Boolean(url));
  if (url) {
    try {
      const u = new URL(url);
  const user = u.username;
  const pass = u.password;
      baseConn = {
        type: 'postgres',
        host: u.hostname,
        port: Number(u.port || 5432),
        username: decodeURIComponent(user || process.env.DB_USER || process.env.DB_USERNAME || 'postgres'),
        password: decodeURIComponent(pass || process.env.DB_PASS || process.env.DB_PASSWORD || ''),
        database: (u.pathname || '/watan').replace(/^\//, '') || process.env.DB_NAME || 'watan',
      };
      // eslint-disable-next-line no-console
      console.log('[DataSource] Dev mode using parsed DATABASE_URL host=%s db=%s', baseConn.host, baseConn.database);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DataSource] Failed to parse DATABASE_URL, falling back to discrete env vars:', e instanceof Error ? e.message : e);
    }
  }
  if (!baseConn) {
    baseConn = {
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? process.env.DB_USERNAME ?? 'postgres',
      password: String(process.env.DB_PASS ?? process.env.DB_PASSWORD ?? ''),
      database: process.env.DB_NAME ?? 'watan',
    };
    // eslint-disable-next-line no-console
  console.log('[DataSource] Dev mode using discrete env vars host=%s db=%s (parsed DATABASE_URL not used)', baseConn.host, baseConn.database);
  }
}

const dataSource = new DataSource({
  ...baseConn,
  entities: [runningTs ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
  migrations: [runningTs ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
  synchronize: false,
});

export default dataSource;

// CLI helper
if (require.main === module) {
  const cmd = process.argv[2];
  dataSource
    .initialize()
    .then(async () => {
      if (cmd === 'migration:run') {
        await dataSource.runMigrations();
        console.log('✅ Migrations ran.');
      } else if (cmd === 'migration:revert') {
        await dataSource.undoLastMigration();
        console.log('↩️ Migration reverted.');
      } else if (cmd === 'migration:show') {
        const hasPending = await dataSource.showMigrations();
        console.log('ℹ️ Pending migrations?', hasPending);
      } else {
        console.log(
          'Usage (DEV):   npx ts-node ./src/data-source.ts migration:run | migration:show | migration:revert\n' +
          'Usage (PROD):  node ./dist/data-source.js migration:run | migration:show | migration:revert'
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}
