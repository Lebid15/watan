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
    return { Authorization: `Bearer ${cfg.apiToken}` };
  }

  async getBalance(cfg: IntegrationConfig): Promise<{ balance: number }> {
    const base = this.buildBase(cfg);
    try {
      // Correct endpoint: client API exposes balance via /client/api/profile not /api/client/wallet/balance
      const { data } = await axios.get(base + '/client/api/profile', {
        headers: this.authHeader(cfg),
        timeout: 10000,
      });
      // Possible shapes: { balance: number } OR { user: { balance } } OR direct field 'balanceUSD3'
      const rawBal = (
        data?.balance ??
        data?.user?.balance ??
        (typeof data?.balanceUSD3 === 'string' ? parseFloat(data.balanceUSD3) : undefined) ??
        0
      );
      const balance = Number(rawBal);
      return { balance: isNaN(balance) ? 0 : balance };
    } catch (e: any) {
      return {
        balance: 0,
        error: 'FETCH_FAILED',
        message: e?.response?.data?.message || e?.message || 'failed',
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
