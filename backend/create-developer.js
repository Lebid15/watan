// Idempotent script to create (or optionally update password of) a global developer user (tenantId NULL)
const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Parse DATABASE_URL if provided
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

// DB config (override via env)
const dbConf = {
  host: process.env.DB_HOST || (parsed?.host || 'postgres'),
  port: +(process.env.DB_PORT || (parsed?.port || 5432)),
  username: process.env.DB_USERNAME || (parsed?.username || 'watan'),
  password: process.env.DB_PASSWORD || (parsed?.password || 'changeme'),
  database: process.env.DB_NAME || (parsed?.database || 'watan'),
};

// Developer credentials (override via env)
const EMAIL = process.env.DEV_EMAIL || 'alayatl.tr@gmail.com';
const PASSWORD = process.env.DEV_PASSWORD || 'Talinnur280986!';

// Force password update if existing
const FORCE_UPDATE = /^(1|true|yes)$/i.test(
  process.env.DEV_FORCE_UPDATE || process.env.FORCE_UPDATE_DEV_PASSWORD || ''
);

console.log('🔧 DB config:', { ...dbConf, password: '***' });
console.log('👤 Target developer email:', EMAIL, 'FORCE_UPDATE=', FORCE_UPDATE);

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
      const dev = existing[0];
      if (FORCE_UPDATE && process.env.DEV_PASSWORD) {
        console.log('♻️ Updating existing developer password...');
        const newHash = await bcrypt.hash(PASSWORD, 10);
        await ds.query(
          'UPDATE users SET password=$1, "updatedAt"=NOW() WHERE id=$2',
          [newHash, dev.id]
        );
        console.log('✅ Password updated for developer:', { id: dev.id, email: dev.email });
      } else {
        console.log('ℹ️ Developer already exists:', dev, '(set DEV_FORCE_UPDATE=1 to update password)');
      }
      return;
    }

    // Create new developer
    const hash = await bcrypt.hash(PASSWORD, 10);
    const id = crypto.randomUUID();
    await ds.query(
      `INSERT INTO users (id, email, password, role, "tenantId", balance, "isActive", "overdraftLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,NULL,0,true,0,NOW(),NOW())`,
      [id, EMAIL, hash, 'developer']
    );
    console.log('✅ Developer created:', { id, email: EMAIL, password: PASSWORD });
  } catch (e) {
    console.error('❌ Error:', e.message || e);
  } finally {
    try { await ds.destroy(); } catch {}
  }
})();