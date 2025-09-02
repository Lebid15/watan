import { isAllowedOrigin } from './passkeys.service';

describe('isAllowedOrigin', () => {
  it('accepts root domain https://syrz1.com', () => {
    expect(isAllowedOrigin('https://syrz1.com')).toBe(true);
  });
  it('accepts subdomain https://sham.syrz1.com', () => {
    expect(isAllowedOrigin('https://sham.syrz1.com')).toBe(true);
  });
  it('rejects http scheme', () => {
    expect(isAllowedOrigin('http://syrz1.com')).toBe(false);
  });
  it('rejects other domain', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false);
  });
  it('rejects similar but not subdomain host', () => {
    expect(isAllowedOrigin('https://syrz1.com.evil.com')).toBe(false);
  });
});
