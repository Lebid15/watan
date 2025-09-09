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
  // Normalize token: strip common prefixes like 'Bearer ' or 'Token '
  const t = cfg.apiToken.trim().replace(/^bearer\s+/i, '').replace(/^token\s+/i, '').trim();
    // If it looks like a 40-char hex (client API token), use api-token header; else assume JWT and use Authorization
    if (/^[a-f0-9]{40}$/i.test(t)) {
      return { 'api-token': t } as any;
    }
    return { Authorization: `Bearer ${t}` } as any;
  }

  async getBalance(cfg: IntegrationConfig): Promise<{ balance: number }> {
    const base = this.buildBase(cfg);
    try {
      // Correct endpoint: client API exposes balance via /client/api/profile not /api/client/wallet/balance
      const headers = this.authHeader(cfg);
      const url = base + '/client/api/profile';
      const { data, status, headers: respHeaders } = await axios.get(url, {
        headers,
        timeout: 10000,
        validateStatus: () => true, // we will interpret non-2xx to include body in diagnostics
      });
      if (data && (data.code === 500 || data.message === 'Unknown error')) {
        // Remote returned internal error – surface as fetch failure with context
        try {
          // Log a compact diagnostic (without secrets)
          const snippet = (() => {
            try { return JSON.stringify(data).slice(0, 400); } catch { return String(data).slice(0, 400); }
          })();
          console.warn('[InternalProvider] profile responded with code=500 envelope', {
            url,
            status,
            remoteSnippet: snippet,
          });
        } catch {}
        return {
          balance: 0,
          error: 'REMOTE_500',
          message: 'Remote internal error',
          status,
          remoteCode: data.code,
          remoteData: (() => { try { return JSON.stringify(data).slice(0, 400); } catch { return String(data).slice(0, 400); } })(),
        } as any;
      }
      // Possible shapes: { balance: number } OR { user: { balance } } OR direct field 'balanceUSD3'
      const rawBal = (
        data?.balance ??
        data?.user?.balance ??
        (typeof data?.balanceUSD3 === 'string' ? parseFloat(data.balanceUSD3) : undefined)
      );
      const balance = Number(rawBal);
      if (rawBal === undefined || rawBal === null || Number.isNaN(balance)) {
        // Don’t silently coerce to 0; surface as provider error so caller can avoid caching/displaying 0
        try {
          const snippet = (() => { try { return JSON.stringify(data).slice(0, 400); } catch { return String(data).slice(0, 400); } })();
          console.warn('[InternalProvider] profile parse failed', { url, status, remoteSnippet: snippet });
        } catch {}
        return {
          balance: 0,
          error: 'BALANCE_PARSE_FAIL',
          message: 'Could not parse balance from client profile',
          status,
          remoteData: (() => { try { return JSON.stringify(data).slice(0, 400); } catch { return String(data).slice(0, 400); } })(),
        } as any;
      }
      return { balance };
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

  async listProducts(cfg: IntegrationConfig): Promise<NormalizedProduct[]> {
    const base = this.buildBase(cfg);
    try {
      const { data } = await axios.get(base + '/api/client/products', { headers: this.authHeader(cfg), timeout: 15000 });
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
