// Idempotent password reset for existing global developer (tenantId NULL)
// Usage (inside container): NEW_DEV_PASSWORD='StrongPass123!' node update-developer-password.js
// Uses argon2id.

const { DataSource } = require('typeorm');
const argon2 = require('argon2');

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
const dbConf = {
  host: process.env.DB_HOST || (parsed?.host || 'postgres'),
  port: +(process.env.DB_PORT || (parsed?.port || 5432)),
  username: process.env.DB_USERNAME || (parsed?.username || 'watan'),
  password: process.env.DB_PASSWORD || (parsed?.password || 'changeme'),
  database: process.env.DB_NAME || (parsed?.database || 'watan'),
};

(async () => {
  const newPw = process.env.NEW_DEV_PASSWORD;
  if (!newPw || newPw.length < 6) {
    console.error('✖ Set NEW_DEV_PASSWORD env var (>=6 chars)');
    process.exit(1);
  }
  const ds = new DataSource({ type: 'postgres', ...dbConf });
  try {
    await ds.initialize();
    console.log('✓ Connected');
    const rows = await ds.query('SELECT id, email FROM users WHERE role=$1 AND "tenantId" IS NULL LIMIT 1', ['developer']);
    if (!rows.length) {
      console.error('✖ No developer user found');
      return;
    }
    const user = rows[0];
    const hash = await argon2.hash(newPw, { type: argon2.argon2id });
    await ds.query('UPDATE users SET password=$1, "updatedAt"=NOW() WHERE id=$2', [hash, user.id]);
    console.log('✓ Developer password updated for', user.email);
  } catch (e) {
    console.error('✖ Error:', e.message || e);
  } finally {
    try { await ds.destroy(); } catch {}
  }
})();
