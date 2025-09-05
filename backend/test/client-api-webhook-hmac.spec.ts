import { buildCanonicalStringV1, hmacSignV1, sha256Hex } from '../src/client-api/client-api-webhook.util';

describe('Client API Webhook HMAC v1', () => {
  it('computes deterministic signature', () => {
    const secret = 'test_secret_123';
    const method = 'POST';
    const path = '/client/webhooks/order-status';
    const timestamp = 1736200000; // fixed
    const nonce = '11111111-2222-3333-4444-555555555555';
    const body = JSON.stringify({ event: 'order-status', event_id: 'abc', status: 'accept' });
    const bodyHash = sha256Hex(body);
    const canonical = buildCanonicalStringV1(method, path, timestamp, nonce, bodyHash);
    const sig = hmacSignV1(secret, canonical);

    // Recompute manually for assurance
    const manual = hmacSignV1(secret, canonical);

    expect(sig).toBe(manual);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    // spot check pieces
    expect(canonical.split('\n')[0]).toBe('POST');
    expect(canonical.split('\n')[1]).toBe(path);
    expect(canonical.split('\n')[2]).toBe(String(timestamp));
    expect(canonical.split('\n')[3]).toBe(nonce);
    expect(canonical.split('\n')[4]).toBe(bodyHash);
  });
});
