import 'reflect-metadata';
import axios from 'axios';

/**
 * Simple smoke test for profile endpoints.
 * Env:
 *   SMOKE_BASE_URL (default http://localhost:3001/api)
 *   SMOKE_JWT (Bearer token without prefix)
 *   SMOKE_TENANT_HOST (e.g. sham.syrz1.com) optional
 */
async function run() {
  const base = (process.env.SMOKE_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '');
  const token = process.env.SMOKE_JWT;
  if (!token) {
    console.error('Missing SMOKE_JWT env. Provide raw JWT (without Bearer).');
    process.exit(2);
  }
  const tenant = process.env.SMOKE_TENANT_HOST || 'sham.syrz1.com';

  async function call(path: string, expect: number) {
    const url = base + path;
    try {
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Host': tenant,
        },
        validateStatus: () => true,
      });
      const ok = res.status === expect;
      console.log(`[SMOKE] ${path} -> ${res.status} (expected ${expect}) ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) {
        console.log(res.data);
        throw new Error(`Unexpected status for ${path}: ${res.status}`);
      }
    } catch (e:any) {
      console.error(`[SMOKE][ERR] ${path}:`, e.message);
      throw e;
    }
  }

  await call('/users/profile', 200);
  await call('/users/profile-with-currency', 200);
  await call('/users/profile-with-', 404);

  console.log('[SMOKE] All checks passed.');
}

run().catch(e => { console.error('[SMOKE] FAILED'); process.exit(1); });
