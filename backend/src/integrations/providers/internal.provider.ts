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
      // Strategy: fetch base=1 (all packages incl. zero-priced) + full list (priced only), then merge prices.
      const headers = { ...this.authHeader(cfg), Accept: 'application/json' } as any;
      const [baseRes, fullRes] = await Promise.all([
        axios.get(base + '/client/api/products?base=1', { headers, timeout: 15000 }).catch(() => ({ data: [] })),
        axios.get(base + '/client/api/products', { headers, timeout: 15000 }).catch(() => ({ data: [] })),
      ]);
      const baseItems = Array.isArray((baseRes as any).data?.items)
        ? (baseRes as any).data.items
        : Array.isArray((baseRes as any).data)
        ? (baseRes as any).data
        : [];
      const fullItems = Array.isArray((fullRes as any).data?.items)
        ? (fullRes as any).data.items
        : Array.isArray((fullRes as any).data)
        ? (fullRes as any).data
        : [];
      const priceMap = new Map<string, { price: number; currency?: string | null }>();
      for (const p of fullItems) {
        const id = String((p as any).id);
        const price = Number((p as any).basePrice ?? (p as any).price ?? 0);
        const currency = (p as any).currencyCode || (p as any).currency || null;
        priceMap.set(id, { price, currency });
      }
      return baseItems.map((p: any) => {
        const id = String(p.id);
        const name = String(p.name || p.title || 'Item');
        const merged = priceMap.get(id);
        const basePrice = merged ? merged.price : Number(p.basePrice ?? p.price ?? 0) || 0;
        const currencyCode = (p.currencyCode || p.currency || (merged ? merged.currency : null)) || null;
        return {
          externalId: id,
          name,
          basePrice,
          category: p.categoryName || null,
          available: true, // base list includes all; availability for selection is allowed
          inputParams: Array.isArray(p.inputParams) ? p.inputParams.map(String) : [],
          quantity: { type: 'none' },
          kind: 'package',
          meta: { currency: currencyCode },
          currencyCode,
        } as NormalizedProduct;
      });
    } catch {
      return [];
    }
  }

  // Create order via the target tenant's Client API
  async placeOrder(
    cfg: IntegrationConfig,
    dto: { productId: string; qty: number; params: Record<string, any>; clientOrderUuid?: string }
  ) {
    const base = this.buildBase(cfg);
    const headers = { ...this.authHeader(cfg), Accept: 'application/json', 'User-Agent': 'Watan-InternalProvider/1.0' } as any;

    // Map common param names to our Client API expectations; pass through the rest as-is
    const qp = new URLSearchParams();
    qp.set('qty', String(dto.qty || 1));
    if (dto.clientOrderUuid) qp.set('order_uuid', String(dto.clientOrderUuid));
    const params = dto.params || {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      let key = k;
      if (k === 'oyuncu_bilgi') key = 'user_identifier';
      if (k === 'extra') key = 'extra_field';
      qp.set(key, String(v));
    }

    const url = `${base}/client/api/newOrder/${encodeURIComponent(dto.productId)}/params?${qp.toString()}`;
    try {
      // Our Client API expects POST, but accepts params from query string
      const res = await axios.post(url, null, { headers, timeout: 15000, maxRedirects: 3 });
      const data: any = res?.data ?? {};

      // Expected response shape from our Client API
      const providerStatus: string = String(data?.status || '');
      const mapped: 'pending' | 'success' | 'failed' = providerStatus === 'accept'
        ? 'success'
        : providerStatus === 'reject'
        ? 'failed'
        : 'pending';

      const priceNum = Number(data?.price_usd ?? data?.priceUSD ?? 0);
      let note: string | undefined =
        data?.message?.toString?.().trim?.() ||
        data?.note?.toString?.().trim?.() ||
        data?.desc?.toString?.().trim?.() ||
        undefined;
      if (!note) {
        if (mapped === 'success') note = 'تم قبول الطلب';
        else if (mapped === 'failed') note = 'تم رفض الطلب';
        else note = 'تم استلام الطلب';
      }

      return {
        success: providerStatus !== 'reject',
        externalOrderId: data?.id ? String(data.id) : undefined,
        providerStatus,
        mappedStatus: mapped,
        price: Number.isFinite(priceNum) ? priceNum : undefined,
        costCurrency: 'USD',
        ...(note ? { note } : {}),
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        mappedStatus: 'failed' as const,
        providerStatus: 'error',
        note: String(err?.response?.data?.message || err?.message || 'failed'),
        raw: {
          status: err?.response?.status,
          body: (() => { try { return JSON.stringify(err?.response?.data).slice(0, 500); } catch { return String(err?.response?.data ?? ''); } })(),
        },
      };
    }
  }

  // Check orders via the target tenant's Client API
  async checkOrders(cfg: IntegrationConfig, ids: string[]) {
    const base = this.buildBase(cfg);
    const headers = { ...this.authHeader(cfg), Accept: 'application/json', 'User-Agent': 'Watan-InternalProvider/1.0' } as any;
  // Our Client API expects a comma-separated list in the `orders` param (not a JSON array string)
  const encoded = encodeURIComponent(ids.join(','));
  const url = `${base}/client/api/check?orders=${encoded}`;
    const res = await axios.get(url, { headers, timeout: 15000, maxRedirects: 3 }).catch((e: any) => ({ data: { error: String(e?.message || e) } } as any));
    const data: any = res?.data ?? {};
    const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return list.map((o: any) => {
      const providerStatus: string = String(o?.status || '');
      const mapped: 'pending' | 'success' | 'failed' = providerStatus === 'accept'
        ? 'success'
        : providerStatus === 'reject'
        ? 'failed'
        : 'pending';
      const note =
        o?.message?.toString?.().trim?.() ||
        o?.note?.toString?.().trim?.() ||
        o?.desc?.toString?.().trim?.() ||
        undefined;
      const pin =
        o?.pin != null
          ? String(o.pin).trim()
          : undefined;
      return {
        externalOrderId: o?.id ? String(o.id) : '',
        providerStatus,
        mappedStatus: mapped,
        ...(note ? { note } : {}),
        ...(pin ? { pin } : {}),
        raw: o,
      };
    });
  }
}
