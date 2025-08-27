// src/utils/api.ts
import axios from 'axios';

/* =========================
   Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØ¨ÙŠØ¦Ø© Ø§Ù„ØªØ´ØºÙŠÙ„
   ========================= */

// Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù€ API (Ù…Ø«Ø§Ù„ Ù…Ø­Ù„ÙŠ: http://localhost:3001/api)
// Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø®Ø§Ù… Ù…Ù† Ø§Ù„Ø¨ÙŠØ¦Ø© (Ù‚Ø¯ ØªÙƒÙˆÙ† Ø®Ø§Ø·Ø¦Ø© Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ÙŠÙ‹Ø§)
let RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
// Dynamic production fallback: if env not provided (still localhost) but we're on a real domain, derive https://api.<root>/api
if (typeof window !== 'undefined') {
  try {
    if (/localhost:3001\/api$/.test(RAW_API_BASE_URL)) {
      const host = window.location.hostname; // e.g. syrz1.com or www.syrz1.com
      const parts = host.split('.');
      if (parts.length >= 2 && !/^api\./i.test(host)) {
        const root = parts.slice(-2).join('.');
        // Avoid using www as subdomain base twice
        const apiHost = `api.${root}`;
        const proto = window.location.protocol === 'https:' ? 'https' : 'http';
        RAW_API_BASE_URL = `${proto}://${apiHost}/api`;
        console.log('[API][AUTO-FALLBACK] Derived API base URL =>', RAW_API_BASE_URL);
      }
    }
  } catch {}
}

// Prefer relative /api when on a tenant subdomain (non api/www) of syrz1.com to eliminate cross-origin & CORS preflight.
// This should help with mysterious timeouts in normal browser mode while incognito works.
if (typeof window !== 'undefined') {
  try {
    // Allow opt-out via env flag
    if (process.env.NEXT_PUBLIC_FORCE_API_ABSOLUTE === '1') {
      // eslint-disable-next-line no-console
      console.log('[API][RELATIVE] Skipped relative /api because NEXT_PUBLIC_FORCE_API_ABSOLUTE=1');
    } else {
      const h = window.location.hostname; // sham.syrz1.com
      if (/\.syrz1\.com$/i.test(h)) {
        const parts = h.split('.');
        if (parts.length > 2) {
          const sub = parts[0].toLowerCase();
          if (!['www', 'api'].includes(sub)) {
            // Switch to relative only if current base points to api.<root> (derived) or localhost default
            if (/api\.[A-Za-z0-9-]+\.[A-Za-z0-9-]+\/api$/.test(RAW_API_BASE_URL) || /localhost:3001\/api$/.test(RAW_API_BASE_URL)) {
              RAW_API_BASE_URL = '/api';
              // eslint-disable-next-line no-console
              console.log('[API][RELATIVE] Using relative /api base for tenant subdomain =>', h);
            }
          }
        }
      }
    }
  } catch {}
}

// Ø­Ø§Ø±Ø³ Ø¯ÙØ§Ø¹ÙŠ: Ø¥Ø°Ø§ Ø§Ù„ØµÙØ­Ø© Ù†ÙØ³Ù‡Ø§ https Ù„ÙƒÙ† Ø§Ù„Ù€ API_BASE_URL ÙŠØ¨Ø¯Ø£ Ø¨Ù€ http Ù„Ù†ÙØ³ Ø§Ù„Ø¯ÙˆÙ…ÙŠÙ† Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ -> Ø§Ø±ÙØ¹ Ù„Ù„Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ https Ù„ØªÙØ§Ø¯ÙŠ Mixed Content
function upgradeToHttpsIfNeeded(raw: string): string {
  try {
    if (typeof window === 'undefined') return raw; // Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ù€ SSR Ù„Ø§ Ù†Ø¹Ø±Ù Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ Ø§Ù„Ù…ØªØµÙØ­
    if (window.location.protocol !== 'https:') return raw; // Ø§Ù„ØµÙØ­Ø© Ù„ÙŠØ³Øª https ÙÙ„Ø§ Ø­Ø§Ø¬Ø©
    if (!/^http:\/\//i.test(raw)) return raw; // Ù„ÙŠØ³ http
    const url = new URL(raw);
    // Ù„Ùˆ Ø§Ù„Ø¯ÙˆÙ…ÙŠÙ† Ù‡Ùˆ api.<rootDomain> ÙˆÙ†ÙØ³ Ø§Ù„Ù€ rootDomain Ø§Ù„Ø°ÙŠ ØªÙØ®Ø¯Ù‘ÙŽÙ… Ù…Ù†Ù‡ Ø§Ù„ØµÙØ­Ø©ØŒ Ù†Ø±ÙØ¹ Ø§Ù„Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„
    const pageHost = window.location.hostname; // Ù…Ø«Ø§Ù„: syrz1.com
    // Ø§Ø³ØªØ®Ø±Ø¬ Ø§Ù„Ø¬Ø°Ø± (Ø¢Ø®Ø± Ù…Ù‚Ø·Ø¹ÙŠÙ† Ø¹Ø§Ø¯Ø©Ù‹) Ø¨Ø´ÙƒÙ„ Ù…Ø¨Ø³Ù‘Ø·
    const pageRoot = pageHost.split('.').slice(-2).join('.');
    const apiRoot = url.hostname.split('.').slice(-2).join('.');
    const isSameRoot = pageRoot === apiRoot;
    const looksLikeApiSub = /^api\./i.test(url.hostname);
    if (isSameRoot && looksLikeApiSub) {
      return raw.replace(/^http:/i, 'https:');
    }
  } catch {
    // ØªØ¬Ø§Ù‡Ù„ Ø£ÙŠ Ø®Ø·Ø£ ØªØ­Ù„ÙŠÙ„
  }
  return raw;
}

// Ø³Ù†Ø³ØªØ®Ø¯Ù… Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„ÙØ¹Ù„ÙŠØ© ÙÙŠ Ø¨Ù†Ø§Ø¡ Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ùˆ axios
const EFFECTIVE_API_BASE_URL = upgradeToHttpsIfNeeded(RAW_API_BASE_URL);
// Ù†ØµØ¯Ø± Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„ÙØ¹Ù„ÙŠØ© Ø¨Ø§Ø³Ù… API_BASE_URL Ù„ÙŠØ³ØªÙ…Ø± Ø¨Ø§Ù‚ÙŠ Ø§Ù„ÙƒÙˆØ¯ (Ø§Ù„Ø°ÙŠ ÙŠØ³ØªÙˆØ±Ø¯ API_BASE_URL) Ø¨Ø§Ù„Ø¹Ù…Ù„ Ø¨Ù‚ÙŠÙ…Ø© Ù…ÙØ±Ù‚Ù‘Ø§Ø©
export const API_BASE_URL = EFFECTIVE_API_BASE_URL;

// Ù‡Ù„ Ø§Ù„Ù€ API Ù…Ø­Ù„ÙŠØŸ
const isLocalhostApi = /^https?:\/\/localhost(?::\d+)?/i.test(
  API_BASE_URL.replace(/\/api\/?$/, '')
);

/** ÙÙ„Ø§Øº Ù„Ù„ØªØ­ÙƒÙ… Ø¨Ø·Ù„Ø¨ "ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨":
 * - ÙŠÙ‚Ø±Ø£ Ù…Ù† NEXT_PUBLIC_ORDERS_DETAILS_ENABLED
 * - Ø¥Ù† Ù„Ù… ÙŠØ­Ø¯ÙŽÙ‘Ø¯ØŒ Ù†Ø¹Ø·Ù„Ù‡Ø§ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ø¹Ù†Ø¯Ù…Ø§ ÙŠÙƒÙˆÙ† Ø§Ù„Ù€ API Ù…Ø­Ù„ÙŠÙ‹Ø§ Ù„ØªØ¬Ù†Ù‘Ø¨ 404
 */
export const ORDERS_DETAILS_ENABLED = (() => {
  const v = process.env.NEXT_PUBLIC_ORDERS_DETAILS_ENABLED;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return !isLocalhostApi; // Ø§ÙØªØ±Ø§Ø¶ÙŠ: Ø¹Ø·Ù‘Ù„ Ù…Ø­Ù„ÙŠÙ‹Ø§ØŒ ÙØ¹ÙÙ‘Ù„ ÙÙŠ Ø§Ù„Ø¥Ù†ØªØ§Ø¬
})();

/** Ù‚Ø±Ø§Ø¡Ø© Ø¨Ø¯Ø§Ø¦Ù„ Ù…Ø³Ø§Ø±Ø§Øª (alts) Ù…Ù† env:
 * NEXT_PUBLIC_ORDERS_ALTS ÙŠÙ…ÙƒÙ† Ø£Ù† ØªÙƒÙˆÙ† JSON Array Ø£Ùˆ Ù‚Ø§Ø¦Ù…Ø© Ù…ÙØµÙˆÙ„Ø© Ø¨ÙÙˆØ§ØµÙ„
 * Ù…Ø«Ø§Ù„: '["/api/orders/me"]' Ø£Ùˆ '/api/orders/me'
 */
function parseAltsEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // Ù„ÙŠØ³ JSON â€” Ø§Ø¹ØªØ¨Ø±Ù‡ Ù‚Ø§Ø¦Ù…Ø© Ø¨ÙÙˆØ§ØµÙ„
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ORDERS_ALTS = parseAltsEnv('NEXT_PUBLIC_ORDERS_ALTS');

/* =========================
   ØªØ¹Ø±ÙŠÙ Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª
   ========================= */

export const API_ROUTES = {
  auth: {
    login: `${EFFECTIVE_API_BASE_URL}/auth/login`,
    register: `${EFFECTIVE_API_BASE_URL}/auth/register`,
    profile: `${EFFECTIVE_API_BASE_URL}/users/profile`,
    changePassword: `${EFFECTIVE_API_BASE_URL}/auth/change-password`,
  forgotPassword: `${EFFECTIVE_API_BASE_URL}/auth/password/forgot`,
  resetPassword: `${EFFECTIVE_API_BASE_URL}/auth/password/reset`,
    passkeys: {
      list: `${EFFECTIVE_API_BASE_URL}/auth/passkeys`,
      regOptions: `${EFFECTIVE_API_BASE_URL}/auth/passkeys/registration/options`,
      regVerify: `${EFFECTIVE_API_BASE_URL}/auth/passkeys/registration/verify`,
      authOptions: `${EFFECTIVE_API_BASE_URL}/auth/passkeys/authentication/options`,
      authVerify: `${EFFECTIVE_API_BASE_URL}/auth/passkeys/authentication/verify`,
      delete: (id: string) => `${EFFECTIVE_API_BASE_URL}/auth/passkeys/${id}`,
    },
  },

  users: {
    base: `${EFFECTIVE_API_BASE_URL}/users`,
    register: `${EFFECTIVE_API_BASE_URL}/users/register`,
    profile: `${EFFECTIVE_API_BASE_URL}/users/profile`,
    me: `${EFFECTIVE_API_BASE_URL}/users/profile`,
    profileWithCurrency: `${EFFECTIVE_API_BASE_URL}/users/profile-with-currency`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}`,
    withPriceGroup: `${EFFECTIVE_API_BASE_URL}/users/with-price-group`,
    toggleActive: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}/active`,
    addFunds: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}/balance/add`,
    setPassword: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}/password`,
    setOverdraft: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}/overdraft`,
  },

  products: {
    base: `${EFFECTIVE_API_BASE_URL}/products`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/products/${id}`,
    priceGroups: `${EFFECTIVE_API_BASE_URL}/products/price-groups`,
  },

  priceGroups: {
    base: `${EFFECTIVE_API_BASE_URL}/products/price-groups` ,
    create: `${EFFECTIVE_API_BASE_URL}/products/price-groups` ,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/products/price-groups/${id}` ,
  },

  currencies: {
    base: `${EFFECTIVE_API_BASE_URL}/currencies`,
    create: `${EFFECTIVE_API_BASE_URL}/currencies`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/currencies/${id}`,
    bulkUpdate: `${EFFECTIVE_API_BASE_URL}/currencies/bulk-update`,
  },

  /* ===== Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ===== */
  orders: {
    base: `${EFFECTIVE_API_BASE_URL}/orders`,
    mine: `${EFFECTIVE_API_BASE_URL}/orders/me`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/orders/${id}`,
    /** ÙŠÙ‚Ø±Ø£Ù‡ Ø§Ù„ÙƒÙ„Ø§ÙŠÙ†Øª Ù„ÙŠØªØ®Ø° Ù‚Ø±Ø§Ø± Ø¬Ù„Ø¨ Ø§Ù„ØªÙØ§ØµÙŠÙ„ Ø£Ùˆ Ù„Ø§ */
    detailsEnabled: ORDERS_DETAILS_ENABLED,
    /** Ø¨Ø¯Ø§Ø¦Ù„ Ù„Ù…Ø³Ø§Ø±Ø§Øª (Ù…Ø«Ù„Ø§Ù‹ /orders/me) Ø¥Ù† Ø±ØºØ¨Øª ÙÙŠ Ø§Ù„ØªØ¬Ø±Ø¨Ø© */
    _alts: ORDERS_ALTS,
  },

  /* ===== Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ø¯Ù…Ù† ===== */
  adminOrders: {
    base: `${EFFECTIVE_API_BASE_URL}/admin/orders`,
    list: `${EFFECTIVE_API_BASE_URL}/admin/orders`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/orders/${id}`,
    bulkManual: `${EFFECTIVE_API_BASE_URL}/admin/orders/bulk/manual`,
    bulkDispatch: `${EFFECTIVE_API_BASE_URL}/admin/orders/bulk/dispatch`,
    bulkApprove: `${EFFECTIVE_API_BASE_URL}/admin/orders/bulk/approve`,
    bulkReject: `${EFFECTIVE_API_BASE_URL}/admin/orders/bulk/reject`,
  },

  notifications: {
    my: `${EFFECTIVE_API_BASE_URL}/notifications/my`,
    readAll: `${EFFECTIVE_API_BASE_URL}/notifications/read-all`,
    readOne: (id: string) => `${EFFECTIVE_API_BASE_URL}/notifications/${id}/read`,
    announce: `${EFFECTIVE_API_BASE_URL}/notifications/announce`,
  },

  /* ===== Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆÙ„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ø¥Ø¯Ù…Ù† ===== */
  admin: {
    upload: `${EFFECTIVE_API_BASE_URL}/admin/upload`,

    catalog: {
      listProducts: (withCounts = false, q?: string) => {
  const base = `${EFFECTIVE_API_BASE_URL}/admin/catalog/products`;
        const params = new URLSearchParams();
        if (withCounts) params.set('withCounts', '1');
        if (q?.trim()) params.set('q', q.trim());
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
      },
  getProduct: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/catalog/products/${id}`,
  setProductImage: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/catalog/products/${id}/image`,
  enableProvider: (providerId: string) => `${EFFECTIVE_API_BASE_URL}/admin/catalog/providers/${providerId}/enable-all`,
  refreshPrices: (providerId: string) => `${EFFECTIVE_API_BASE_URL}/admin/catalog/providers/${providerId}/refresh-prices`,
    },

    paymentMethods: {
  base: `${EFFECTIVE_API_BASE_URL}/admin/payment-methods`,
  upload: `${EFFECTIVE_API_BASE_URL}/admin/upload`,
  byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/payment-methods/${id}`,
    },

    deposits: {
  base: `${EFFECTIVE_API_BASE_URL}/admin/deposits`,
      setStatus: (id: string) => `${API_BASE_URL}/admin/deposits/${id}/status`,
      list: (p?: Record<string, string | number | boolean>) => {
  const base = `${EFFECTIVE_API_BASE_URL}/admin/deposits`;
        if (!p) return base;
        const qs = new URLSearchParams(
          Object.fromEntries(
            Object.entries(p).map(([k, v]) => [k, String(v)])
          )
        ).toString();
        return qs ? `${base}?${qs}` : base;
      },
    },

    integrations: {
  base: `${EFFECTIVE_API_BASE_URL}/admin/integrations`,
  byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}`,
  test: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}/test`,
      refreshBalance: (id: string) =>
        `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}/refresh-balance`,
      balance: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}/balance`,
      packages: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}/packages`,
      syncProducts: (id: string) =>
        `${EFFECTIVE_API_BASE_URL}/admin/integrations/${id}/sync-products`,

      // ØªÙƒØ§Ù„ÙŠÙ Ø§Ù„Ù…Ø²ÙˆØ¯ÙŠÙ†
  providerCost: `${EFFECTIVE_API_BASE_URL}/admin/integrations/provider-cost`,

      // ØªÙˆØ¬ÙŠÙ‡ Ø§Ù„Ø­Ø²Ù… (Ù…Ø¹ Ø¯Ø¹Ù… q Ø§Ø®ØªÙŠØ§Ø±ÙŠ)
      routingAll: (q?: string) => {
  const base = `${EFFECTIVE_API_BASE_URL}/admin/integrations/routing/all`;
        const qq = q?.trim();
        return qq ? `${base}?q=${encodeURIComponent(qq)}` : base;
      },
  routingSet: `${EFFECTIVE_API_BASE_URL}/admin/integrations/routing/set`,
  routingSetType: `${EFFECTIVE_API_BASE_URL}/admin/integrations/routing/set-type`,
  routingSetCodeGroup: `${EFFECTIVE_API_BASE_URL}/admin/integrations/routing/set-code-group`,
    },

    reports: {
      profits: `${EFFECTIVE_API_BASE_URL}/admin/reports/profits`,
      users: `${EFFECTIVE_API_BASE_URL}/admin/reports/users`,
      providers: `${EFFECTIVE_API_BASE_URL}/admin/reports/providers`,
    },
  },

  /* ===== ØµÙØ­Ø§Øª Ø¹Ø§Ù…Ø© ÙŠÙØ­Ø±Ø±Ù‡Ø§ Ø§Ù„Ø£Ø¯Ù…Ù† (Ù…Ù† Ù†Ø­Ù† / ØªØ¹Ù„ÙŠÙ…Ø§Øª) ===== */
  site: {
    public: {
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: /user/about */
  about: `${EFFECTIVE_API_BASE_URL}/pages/about`,
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: /user/infoes */
  infoes: `${EFFECTIVE_API_BASE_URL}/pages/infoes`,
    },
    admin: {
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ Ù„ÙˆØ­Ø© Ø§Ù„Ø£Ø¯Ù…Ù† (Ù‚Ø³Ù… "Ù…Ù† Ù†Ø­Ù†"): GET/PUT Ù†Øµ ÙƒØ¨ÙŠØ± */
  about: `${EFFECTIVE_API_BASE_URL}/admin/settings/about`,
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ Ù„ÙˆØ­Ø© Ø§Ù„Ø£Ø¯Ù…Ù† (Ù‚Ø³Ù… "ØªØ¹Ù„ÙŠÙ…Ø§Øª"): GET/PUT Ù†Øµ ÙƒØ¨ÙŠØ± */
  infoes: `${EFFECTIVE_API_BASE_URL}/admin/settings/infoes`,
    },
  },

  /* ===== ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø¥ÙŠØ¯Ø§Ø¹Ø§Øª (Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…) ===== */
  payments: {
    methods: {
      active: `${EFFECTIVE_API_BASE_URL}/payment-methods/active`,
    },
    deposits: {
      base: `${EFFECTIVE_API_BASE_URL}/deposits`,    // GET Ù‚Ø§Ø¦Ù…Ø©/ POST Ø¥Ù†Ø´Ø§Ø¡
      create: `${EFFECTIVE_API_BASE_URL}/deposits`,  // POST /deposits
      mine: `${EFFECTIVE_API_BASE_URL}/deposits/mine`,
    },
  },
  dev: {
    errors: {
      ingest: `${EFFECTIVE_API_BASE_URL}/dev/errors/ingest`,
      list: (p?: Record<string,string|number>) => {
        const base = `${EFFECTIVE_API_BASE_URL}/dev/errors`;
        if (!p) return base;
        const qs = new URLSearchParams(Object.entries(p).map(([k,v])=>[k,String(v)])).toString();
        return qs ? base+`?${qs}` : base;
      },
      byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/dev/errors/${id}`,
      resolve: (id: string) => `${EFFECTIVE_API_BASE_URL}/dev/errors/${id}/resolve`,
      delete: (id: string) => `${EFFECTIVE_API_BASE_URL}/dev/errors/${id}`,
    }
  },
};

/* =========================
   Ù†Ø³Ø®Ø© axios + Interceptors
   ========================= */

const api = axios.create({
  baseURL: EFFECTIVE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// helper Ø¨Ø³ÙŠØ· Ù„Ù‚Ø±Ø§Ø¡Ø© ÙƒÙˆÙƒÙŠ Ø¨Ø§Ù„Ø§Ø³Ù…
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

// Ø¯Ø§Ù„Ø© Ù…Ø´ØªØ±ÙƒØ© Ù„Ø¥Ø¶Ø§ÙØ© headers (Ù…ÙˆØ­Ù‘Ø¯Ø©)
function addTenantHeaders(config: any) {
  config.headers = config.headers || {};

  // 1) Ø­Ø§ÙˆÙ„ Ø£Ø®Ø° subdomain Ù…Ù† Ø§Ù„ÙƒÙˆÙƒÙŠ (ÙŠÙÙŠØ¯ Ø£Ø«Ù†Ø§Ø¡ SSR Ø£Ùˆ Ù‚Ø¨Ù„ ØªÙˆÙØ± window)
  const tenantCookie = getCookie('tenant_host');
  if (tenantCookie && !config.headers['X-Tenant-Host']) {
    config.headers['X-Tenant-Host'] = tenantCookie;
  }

  // 2) ÙÙŠ Ø§Ù„Ù…ØªØµÙØ­: Ø§Ø³ØªØ®Ø±Ø¬ Ù…Ø¨Ø§Ø´Ø±Ø© Ù…Ù† window.host ÙˆØ­Ø¯Ø« Ø§Ù„ÙƒÙˆÙƒÙŠ Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù„Ø§Ø­Ù‚Ø§Ù‹
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;          // Ù…Ø«Ø§Ù„: saeed.localhost:3000
    if (currentHost.includes('.localhost')) {
      const sub = currentHost.split('.')[0];
      if (sub && sub !== 'localhost' && sub !== 'www') {
        const tenantHost = `${sub}.localhost`;
        if (!config.headers['X-Tenant-Host']) {
          config.headers['X-Tenant-Host'] = tenantHost;
        }
        // Ø®Ø²Ù‘Ù†Ù‡ ÙÙŠ ÙƒÙˆÙƒÙŠ Ù„ÙŠØ³ØªÙÙŠØ¯ Ù…Ù†Ù‡ Ø£ÙŠ Ø·Ù„Ø¨ ÙŠØªÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± (SSR) Ø£Ùˆ fetch Ø¨Ø¯ÙˆÙ† window Ù„Ø§Ø­Ù‚Ø§Ù‹
        document.cookie = `tenant_host=${tenantHost}; path=/`;
      }
    }
    // Production multi-tenant: *.syrz1.com (exclude bare root, www, api)
    else if (/\.syrz1\.com$/i.test(currentHost)) {
      const hostParts = currentHost.split('.');
      if (hostParts.length > 2) {
        const sub = hostParts[0].toLowerCase();
        if (!['www', 'api'].includes(sub)) {
          if (!config.headers['X-Tenant-Host']) {
            config.headers['X-Tenant-Host'] = currentHost;
          }
          document.cookie = `tenant_host=${currentHost}; path=/`;
        }
      }
    }
  }

  // 3) Ø§Ù„ØªÙˆÙƒÙ†
  if (typeof window !== 'undefined') {
    let token: string | null = localStorage.getItem('token');
    if (!token) token = getCookie('access_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
}
// Patch Ù„Ù„Ù€ fetch Ù„ØªØºØ·ÙŠØ© Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ØªÙŠ Ù„Ø§ ØªÙ…Ø± Ø¹Ø¨Ø± axios
if (typeof window !== 'undefined' && !(window as any).__TENANT_FETCH_PATCHED__) {
  (window as any).__TENANT_FETCH_PATCHED__ = true;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const newInit: RequestInit = init ? { ...init } : {};
    const headers = new Headers(newInit.headers || (typeof input === 'object' && (input as any).headers) || {});

    // Ø¥Ù† Ù„Ù… ÙŠÙˆØ¬Ø¯ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø£Ø¶ÙÙÙ‡
    if (!headers.has('X-Tenant-Host')) {
      const h = window.location.host;
      if (h.includes('.localhost')) {
        const sub = h.split('.')[0];
        if (sub && sub !== 'localhost' && sub !== 'www') {
          const tenantHost = `${sub}.localhost`;
          headers.set('X-Tenant-Host', tenantHost);
          document.cookie = `tenant_host=${tenantHost}; path=/`;
          console.log(`[FETCH] Setting X-Tenant-Host header: ${tenantHost}`);
        }
      } else if (/\.syrz1\.com$/i.test(h)) {
        const parts = h.split('.');
        if (parts.length > 2) {
          const sub = parts[0].toLowerCase();
          if (!['www', 'api'].includes(sub)) {
            headers.set('X-Tenant-Host', h);
            document.cookie = `tenant_host=${h}; path=/`;
            console.log(`[FETCH] Setting X-Tenant-Host header (prod): ${h}`);
          }
        }
      }
    }

    // Ø£Ø¶Ù Ø§Ù„ØªÙˆÙƒÙ† Ø¥Ù† Ù„Ù… ÙŠÙƒÙ† Ù…ÙˆØ¬ÙˆØ¯Ø§Ù‹
    if (!headers.has('Authorization')) {
      let token: string | null = localStorage.getItem('token');
      if (!token) token = getCookie('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    newInit.headers = headers;
    return originalFetch(input, newInit);
  };
}
// ØªØ£ÙƒØ¯ Ù…Ù† Ø¹Ø¯Ù… ØªÙƒØ±Ø§Ø± ØªØ³Ø¬ÙŠÙ„ Ù†ÙØ³ Ø§Ù„Ù€ interceptor (Ù†ÙØ­Øµ flag Ø¹Ù„Ù‰ axios Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠ)
const ANY_AXIOS: any = axios as any;
if (!ANY_AXIOS.__TENANT_HEADERS_ATTACHED__) {
  ANY_AXIOS.__TENANT_HEADERS_ATTACHED__ = true;
  api.interceptors.request.use((config) => {
    // console.log(`[API] -> ${config.method} ${config.url}`);
    return addTenantHeaders(config);
  });
  axios.interceptors.request.use((config) => {
    return addTenantHeaders(config);
  });
}

// src/utils/api.ts â€” Ø¯Ø§Ø®Ù„ interceptor Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„Ø§Ø³ØªØ¬Ø§Ø¨Ø©
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      const p = window.location.pathname || '';
      const inBackoffice = p.startsWith('/admin') || p.startsWith('/dev');
      const onAuthPages  = p === '/login' || p === '/register';

      if (!inBackoffice && !onAuthPages) {
        localStorage.removeItem('token');
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

