#!/usr/bin/env node
/**
 * Fetch developer JWT without wrestling with curl quoting.
 * Usage:
 *   BOOTSTRAP_DEV_SECRET=... DEV_ISSUE_SECRET=... \
 *   DEV_EMAIL=alayatl.tr@gmail.com \
 *   npm run dev:token -- [--tenant <tenantId>] [--host http://localhost:3000]
 *
 * Or directly:
 *   node scripts/request-dev-token.cjs --tenant 0000... --host http://localhost:3000
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tenant' && args[i+1]) { out.tenantId = args[++i]; continue; }
    if (a === '--host' && args[i+1]) { out.host = args[++i]; continue; }
  }
  return out;
}

(async () => {
  try {
    const { tenantId, host = process.env.API_HOST || 'http://localhost:3000' } = parseArgs();
    const email = process.env.DEV_EMAIL || 'alayatl.tr@gmail.com';
    const secret = process.env.DEV_ISSUE_SECRET; // required
    if (!secret) {
      console.error('DEV_ISSUE_SECRET env var required');
      process.exit(1);
    }
    const url = new URL('/api/auth/dev-token', host);
    const body = JSON.stringify({ secret, email, tenantId });
    console.log('[dev-token] Host:', host);
    console.log('[dev-token] Email:', email);
    console.log('[dev-token] TenantId override:', tenantId ?? '(none)');

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            console.log('\nToken:');
            console.log(json.token);
            console.log('\nDecoded payload:');
            console.log(json.payload);
            console.log('\nExport command (PowerShell):');
            console.log(`$env:JWT='${json.token}'`);
          } catch (e) {
            console.error('Parse error:', e.message, data);
            process.exit(1);
          }
        } else {
      console.error('Request failed', res.statusCode, data || '(no body)');
          process.exit(1);
        }
      });
    });
    req.on('error', e => { console.error('Error:', e && e.message ? e.message : e); if (e && e.stack) console.error(e.stack); process.exit(1); });
    req.write(body); req.end();
  } catch (e) {
    console.error('Fatal', e); process.exit(1);
  }
})();
