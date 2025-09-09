import { ProviderDriver } from './provider-driver.interface';
import { IntegrationConfig, NormalizedProduct } from '../types';
import axios from 'axios';

/** Internal provider driver: wraps another tenant's public client API using the provided apiToken. */
export class InternalProvider implements ProviderDriver {
  private buildBase(cfg: IntegrationConfig) {
    // Expect baseUrl like: tenant.example.com (without protocol) OR full URL
    let raw = cfg.baseUrl?.trim() || '';
    if (!raw) throw new Error('Internal provider requires baseUrl');
  // Sanitize: remove any leading slashes the UI might have stored (e.g. "/https://domain")
  raw = raw.replace(/^\/+/, '');
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  // Collapse accidental double protocol like https:///https://domain
  raw = raw.replace(/https?:\/\/+(https?:\/\/)/i, '$1');
  return raw.replace(/\/$/, '');
  }

  private authHeader(cfg: IntegrationConfig) {
    if (!cfg.apiToken) throw new Error('Internal provider requires apiToken');
    // Only use x-api-token (strip common prefixes if present)
    const t = cfg.apiToken.trim().replace(/^bearer\s+/i, '').replace(/^token\s+/i, '').trim();
    return { 'x-api-token': t } as any;
  }

  private maskHeaders(h: Record<string, any>) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(h || {})) {
      if (/x-api-token/i.test(k)) out[k] = '***MASKED***';
      else out[k] = v;
    }
    return out;
  }

  // Manual redirect-following GET to capture redirect chain and enforce same-host redirects
  private async getWithRedirects(url: string, headers: Record<string, any>, max: number = 3) {
    const redirects: Array<{ url: string; status: number }> = [];
    let current = url;
    const startHost = (() => { try { return new URL(url).hostname; } catch { return null; } })();
    for (let i = 0; i <= max; i++) {
      const res = await axios.get(current, {
        headers,
        timeout: 12000,
        // Do not auto-follow redirects; we want to see 3xx responses
        maxRedirects: 0,
        validateStatus: () => true,
      });
      const status = res.status;
      if (status >= 300 && status < 400) {
        const loc = res.headers?.location || res.headers?.Location;
        if (!loc) {
          return { status, data: res.data, finalUrl: current, redirects };
        }
        const next = (() => { try { return new URL(loc, current).toString(); } catch { return null; } })();
        if (!next) {
          return { status, data: res.data, finalUrl: current, redirects };
        }
        const hostOk = (() => { try { return new URL(next).hostname === startHost; } catch { return false; } })();
        redirects.push({ url: next, status });
        if (!hostOk) {
          // Cross-host redirect is not allowed
          return { status, data: res.data, finalUrl: current, redirects, crossHost: true } as any;
        }
        current = next;
        continue;
      }
      // Non-redirect response (2xx/4xx/5xx)
      return { status, data: res.data, finalUrl: current, redirects };
    }
    // Too many redirects
    return { status: 310, data: null, finalUrl: current, redirects };
  }

  async getBalance(cfg: IntegrationConfig): Promise<{ balance: number }> {
    const base = this.buildBase(cfg);
    try {
      // Correct endpoint: client API exposes balance via /client/api/profile not /api/client/wallet/balance
      const headersBase = this.authHeader(cfg);
      const url = base + '/client/api/profile';
      const commonHeaders: any = {
        ...headersBase,
        Accept: 'application/json',
        'User-Agent': 'Watan-InternalProvider/1.0',
      };
      const first = await this.getWithRedirects(url, commonHeaders, 3);
      const { data, status } = first;
      if (data && (data.code === 500 || data.message === 'Unknown error')) {
        // Remote returned internal error – surface as fetch failure with context
        try {
          const snippet = (() => { try { return JSON.stringify(data).slice(0, 500); } catch { return String(data).slice(0, 500); } })();
          console.warn('[InternalProvider] REMOTE_500', {
            providerId: cfg.id,
            baseUrl: cfg.baseUrl,
            finalUrl: (first as any).finalUrl || url,
            status,
            responseBody: snippet,
            usedHeaders: this.maskHeaders(commonHeaders),
            redirects: (first as any).redirects || [],
          });
        } catch {}
        return {
          balance: 0,
          error: 'REMOTE_500',
          message: 'Remote internal error',
          status,
          remoteCode: data.code,
          remoteData: (() => { try { return JSON.stringify(data).slice(0, 500); } catch { return String(data).slice(0, 500); } })(),
        } as any;
      }
      // Attempt to parse balance; if it fails, try fallback endpoints
      const parseBalance = (d: any) => {
        const raw = (d?.balance ?? d?.user?.balance ?? (typeof d?.balanceUSD3 === 'string' ? parseFloat(d.balanceUSD3) : undefined) ?? d?.data?.balance ?? d?.amount);
        const n = Number(raw);
        return raw === undefined || raw === null || Number.isNaN(n) ? null : n;
      };
      let parsed = parseBalance(data);
      if (parsed !== null) return { balance: parsed, currency: (data?.currency || data?.user?.currency || null) } as any;

      // Fallback 1: /api/client/profile
      const url2 = base + '/api/client/profile';
  const second = await this.getWithRedirects(url2, commonHeaders, 2);
  const { data: data2, status: status2 } = { data: (second as any).data, status: (second as any).status } as any;
      parsed = parseBalance(data2);
  if (parsed !== null) return { balance: parsed, currency: (data2?.currency || data2?.user?.currency || null) } as any;

      // Fallback 2: /api/client/wallet/balance
      const url3 = base + '/api/client/wallet/balance';
  const third = await this.getWithRedirects(url3, commonHeaders, 2);
  const { data: data3, status: status3 } = { data: (third as any).data, status: (third as any).status } as any;
      parsed = parseBalance(data3);
  if (parsed !== null) return { balance: parsed, currency: (data3?.currency || data3?.user?.currency || null) } as any;

      // If still not parsed, report diagnostics
      try {
        const snippet1 = (() => { try { return JSON.stringify(data).slice(0, 400); } catch { return String(data).slice(0, 400); } })();
        const snippet2 = (() => { try { return JSON.stringify(data2).slice(0, 400); } catch { return String(data2).slice(0, 400); } })();
        const snippet3 = (() => { try { return JSON.stringify(data3).slice(0, 400); } catch { return String(data3).slice(0, 400); } })();
        console.warn('[InternalProvider] balance parse failed after fallbacks', {
          providerId: cfg.id,
          baseUrl: cfg.baseUrl,
          url,
          url2,
          url3,
          status,
          status2,
          status3,
          remote1: snippet1,
          remote2: snippet2,
          remote3: snippet3,
        });
      } catch {}
      return {
        balance: 0,
        error: 'BALANCE_PARSE_FAIL',
        message: 'Could not parse balance from client profile (after fallbacks)',
        status,
        remoteData: (() => { try { return JSON.stringify({ p1: data, p2: data2, p3: data3 }).slice(0, 600); } catch { return undefined; } })(),
      } as any;
    } catch (e: any) {
      return {
        balance: 0,
        error: 'FETCH_FAILED',
        message: e?.response?.data?.message || e?.message || 'failed',
        hint: 'internal-provider-profile-request',
        status: e?.response?.status,
        remoteData: (() => {
          try {
            const d = e?.response?.data;
            if (!d) return undefined;
            return typeof d === 'object' ? JSON.stringify(d).slice(0, 300) : String(d).slice(0, 300);
          } catch { return undefined; }
        })(),
      } as any;
    }
  }

  // Debug helper to test with and without x-api-token
  async debugBalance(cfg: IntegrationConfig) {
    const base = this.buildBase(cfg);
    const url = base + '/client/api/profile';
    const withTokenHeaders = { ...this.authHeader(cfg), Accept: 'application/json', 'User-Agent': 'Watan-InternalProvider/1.0' };
    const withoutTokenHeaders = { Accept: 'application/json', 'User-Agent': 'Watan-InternalProvider/1.0' } as any;
    const a = await this.getWithRedirects(url, withTokenHeaders, 3);
    const b = await this.getWithRedirects(url, withoutTokenHeaders, 3);
    const snip = (d: any) => { try { return JSON.stringify(d).slice(0, 200); } catch { return String(d).slice(0, 200); } };
    console.warn('[InternalProvider][DebugTest]', {
      providerId: cfg.id,
      baseUrl: cfg.baseUrl,
      A: { status: a.status, finalUrl: (a as any).finalUrl || url, body: snip(a.data), redirects: (a as any).redirects || [] },
      B: { status: b.status, finalUrl: (b as any).finalUrl || url, body: snip(b.data), redirects: (b as any).redirects || [] },
      usedHeaders: this.maskHeaders(withTokenHeaders),
    });
    return {
      ok: true,
      A: { status: a.status, finalUrl: (a as any).finalUrl || url, bodySnippet: snip(a.data) },
      B: { status: b.status, finalUrl: (b as any).finalUrl || url, bodySnippet: snip(b.data) },
    };
  }

  async listProducts(cfg: IntegrationConfig): Promise<NormalizedProduct[]> {
    const base = this.buildBase(cfg);
    try {
      // Use the same public Client API contract as balance/profile
      // Correct path is /client/api/products (not /api/client/products)
      const { data } = await axios.get(base + '/client/api/products', {
        headers: { ...this.authHeader(cfg), Accept: 'application/json' },
        timeout: 15000,
      });
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      return arr.map((p: any) => ({
        externalId: String(p.id),
        name: String(p.name || p.title || 'Item'),
        basePrice: Number(p.basePrice ?? p.price ?? 0),
        category: p.categoryName || null,
        available: p.isActive !== false,
        inputParams: Array.isArray(p.inputParams) ? p.inputParams.map(String) : [],
        quantity: { type: 'none' },
        kind: 'package',
        meta: { currency: p.currencyCode || p.currency || null },
        currencyCode: p.currencyCode || null,
      }));
    } catch {
      return [];
    }
  }
}
