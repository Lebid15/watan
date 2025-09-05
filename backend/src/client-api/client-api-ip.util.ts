import * as net from 'net';

// Normalize client IP extracted from X-Forwarded-For / remoteAddress.
// Rules:
// 1. Use first IP in X-Forwarded-For chain (original client) if present.
// 2. Strip IPv6 mapped prefix ::ffff: for IPv4-mapped addresses.
// 3. Map ::1 to 127.0.0.1 for developer convenience.
// 4. Return lowercase canonical form (IPv6 left as provided; we only strip redundant IPv4 mapping).
export function extractNormalizedIp(xForwardedFor: string | string[] | undefined, remoteAddress: string | undefined): string {
  let chain: string[] = [];
  if (typeof xForwardedFor === 'string') {
    chain = xForwardedFor.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(xForwardedFor)) {
    chain = xForwardedFor.flatMap(v => (v || '').split(',')).map(s => s.trim()).filter(Boolean);
  }
  // First IP in chain is the original client (common proxy semantics)
  let ip = chain.length ? chain[0] : (remoteAddress || '');
  if (!ip) return '';
  // Strip port if present (e.g., 203.0.113.5:12345 or [2001:db8::1]:443)
  if (ip.startsWith('[') && ip.includes(']')) {
    // [IPv6]:port
    const closing = ip.indexOf(']');
    ip = ip.slice(1, closing);
  } else if (ip.includes(':') && ip.split(':').length === 2 && ip.match(/^[0-9a-fA-F:.]+:[0-9]+$/)) {
    // IPv4:port form
    ip = ip.split(':')[0];
  }
  // IPv4-mapped IPv6 ::ffff:
  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') ip = '127.0.0.1';
  // Basic validation; if net.isIP fails keep original for traceability.
  if (net.isIP(ip)) return ip.toLowerCase();
  return ip.toLowerCase();
}

// Compare normalized IP against allow list (strings). Allow exact match only for now.
export function ipAllowed(allowList: string[], candidate: string): boolean {
  if (!candidate) return false;
  const c = candidate.toLowerCase();
  return allowList.some(a => a && a.toLowerCase() === c);
}