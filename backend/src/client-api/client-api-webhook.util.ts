import * as crypto from 'crypto';

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function buildCanonicalStringV1(method: string, path: string, timestamp: number, nonce: string, bodyHash: string): string {
  return [method.toUpperCase(), path, String(timestamp), nonce, bodyHash].join('\n');
}

export function hmacSignV1(secret: string, canonical: string): string {
  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

export function generateWebhookSecret(len = 48): string {
  // produce base64url-like (hex simpler) secret; hex length = len
  return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len);
}
