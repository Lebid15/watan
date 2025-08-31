// Centralized lightweight debug flag helper.
// Usage patterns supported:
//   DEBUG=1 (enable all)
//   DEBUG=true (enable all)
//   DEBUG=tenantCtx,tenantGuard,userProfile (comma or space separated list)
// Backwards compatibility: legacy per‑area flags like DEBUG_TENANT_CTX=1 still work.

const LEGACY_PREFIX = 'DEBUG_';

function legacyEnabled(key: string): boolean {
  const envKey = `${LEGACY_PREFIX}${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`; // camelCase -> DEBUG_TENANT_CTX
  return process.env[envKey] === '1';
}

export function debugEnabled(...areas: string[]): boolean {
  // If any legacy specific flag active, allow
  if (areas.some(a => legacyEnabled(a))) return true;

  const dbg = process.env.DEBUG;
  if (!dbg) return false;
  if (dbg === '1' || dbg.toLowerCase() === 'true' || dbg.toLowerCase() === 'all') return true;

  // split on comma / whitespace
  const tokens = dbg.split(/[\s,]+/).filter(Boolean);
  return areas.some(a => tokens.includes(a));
}

export function debugLog(area: string, ...args: any[]) {
  if (debugEnabled(area)) {
    // eslint-disable-next-line no-console
    console.log(`[${area}]`, ...args);
  }
}

export function debugError(area: string, ...args: any[]) {
  if (debugEnabled(area)) {
    // eslint-disable-next-line no-console
    console.error(`[${area}][ERROR]`, ...args);
  }
}
