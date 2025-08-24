// Idempotent script to create a global developer user (tenantId NULL)
const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Accept DATABASE_URL=postgres://user:pass@host:port/dbname if provided
function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return {
      username: u.username,
      password: u.password,
      host: u.hostname,
      port: +(u.port || 5432),
      database: u.pathname.replace(/^\//, '') || 'watan',
    };
  } catch {
    return null;
  }
}

const parsed = process.env.DATABASE_URL ? parseDatabaseUrl(process.env.DATABASE_URL) : null;

// Container-friendly defaults (overrideable via env)
const dbConf = {
  host: process.env.DB_HOST || (parsed?.host || 'postgres'),
  port: +(process.env.DB_PORT || (parsed?.port || 5432)),
  username: process.env.DB_USERNAME || (parsed?.username || 'watan'),
  password: process.env.DB_PASSWORD || (parsed?.password || 'changeme'),
  database: process.env.DB_NAME || (parsed?.database || 'watan'),
};

// Developer credentials (override via DEV_EMAIL / DEV_PASSWORD)
const EMAIL = process.env.DEV_EMAIL || 'alayatl.tr@gmail.com';
const PASSWORD = process.env.DEV_PASSWORD || 'Talinnur280986!';

console.log('🔧 Using DB config:', { ...dbConf, password: '***' });

const ds = new DataSource({ type: 'postgres', ...dbConf });

(async () => {
  try {
    await ds.initialize();
    console.log('✅ Connected');
    const existing = await ds.query(
      'SELECT id, email, role FROM users WHERE email=$1 AND role=$2 AND "tenantId" IS NULL LIMIT 1',
      [EMAIL, 'developer']
    );
    if (existing.length) {
      console.log('ℹ️ Developer user already exists:', existing[0]);
      return;
    }
    const hash = await bcrypt.hash(PASSWORD, 10);
    const id = crypto.randomUUID();
    await ds.query(
      `INSERT INTO users (id, email, password, role, "tenantId", balance, "isActive", "overdraftLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,NULL,0,true,0,NOW(),NOW())`,
      [id, EMAIL, hash, 'developer']
    );
    console.log('✅ Developer user created:', { id, email: EMAIL, password: PASSWORD });
  } catch (e) {
    console.error('❌ Error:', e.message || e);
  } finally {
    await ds.destroy();
  }
})();
