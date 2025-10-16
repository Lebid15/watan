// src/utils/api.ts
import axios, { type AxiosRequestConfig } from 'axios';

/* =========================
   Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØ¨ÙŠØ¦Ø© Ø§Ù„ØªØ´ØºÙŠÙ„
   ========================= */

// عنوان الـ API (مثال إنتاج: https://api.wtn4.com/api) نستخدمه كما هو بدون أي fallback نسبي.
// افتراضيًا بعد الانتقال إلى djangoo نوجّه إلى /api-dj على المنفذ 8000.
const DEFAULT_API_BASE_URL = (process.env.NEXT_PUBLIC_USE_OLD_BACKEND || '').toLowerCase() === 'true'
  ? 'http://localhost:3001/api'
  : 'http://127.0.0.1:8000/api-dj';

const RAW_API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

// Prefer relative /api when on a tenant subdomain (non api/www) of wtn4.com to eliminate cross-origin & CORS preflight.
// This should help with mysterious timeouts in normal browser mode while incognito works.
// Disabled: relative /api caused 404 on tenant subdomains because frontend host doesn't serve backend endpoints.
// Keeping absolute api.<root>/api base to avoid redirect loops & 404.

// Ø­Ø§Ø±Ø³ Ø¯ÙƒØ§Ø±Ø§Øª: Ø¥Ø°Ø§ Ø§Ù„ØµÙØ­Ø© Ù†ÙØ³Ù‡Ø§ https Ù„ÙƒÙ† Ø§Ù„Ù€ API_BASE_URL ÙŠØ¨Ø¯Ø£ Ø¨Ù€ http Ù„Ù†ÙØ³ Ø§Ù„Ø¯ÙˆÙ…ÙŠÙ† Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ -> Ø§Ø±ÙØ¹ Ù„Ù„Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ https Ù„ØªÙØ§Ø¯ÙŠ Mixed Content
function upgradeToHttpsIfNeeded(raw: string): string {
  try {
    if (typeof window === 'undefined') return raw; // Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ù€ SSR Ù„Ø§ Ù†Ø¹Ø±Ù Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ Ø§Ù„Ù…ØªØµÙØ­
    if (window.location.protocol !== 'https:') return raw; // Ø§Ù„ØµÙØ­Ø© Ù„ÙŠØ³Øª https ÙÙ„Ø§ Ø­Ø§Ø¬Ø©
    if (!/^http:\/\//i.test(raw)) return raw; // Ù„ÙŠØ³ http
    const url = new URL(raw);
    // Ù„Ùˆ Ø§Ù„Ø¯ÙˆÙ…ÙŠÙ† Ù‡Ùˆ api.<rootDomain> ÙˆÙ†ÙØ³ Ø§Ù„Ù€ rootDomain Ø§Ù„Ø°ÙŠ ØªÙØ®Ø¯Ù‘ÙŽÙ… Ù…Ù†Ù‡ Ø§Ù„ØµÙØ­Ø©ØŒ Ù†Ø±ÙØ¹ Ø§Ù„Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„
  const pageHost = window.location.hostname; // مثال: wtn4.com
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

// Ø³Ù†Ø³ØªØ®Ø¯Ù… Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙŠÙمØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© ÙÙŠ Ø¨Ù†Ø§Ø¡ Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ùˆ axios
const EFFECTIVE_API_BASE_URL = (() => {
  const v = upgradeToHttpsIfNeeded(RAW_API_BASE_URL);
  // في التطوير: وجّه مباشرةً إلى Django لتجنب مشكلة إزالة الشرطة قبل الاستعلام في Next.js rewrites
  if (v === '/api-dj') {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) return 'http://127.0.0.1:8000/api-dj';
  }
  return v;
})();
// Ù†ØµØ¯Ø± Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„ÙØ¹Ù„ÙŠØ© Ø¨Ø§Ø³Ù… API_BASE_URL Ù„ÙŠØ³ØªÙ…Ø± Ø¨Ø§Ù‚ÙŠ Ø§Ù„ÙƒÙˆØ¯ (Ø§Ù„Ø°ÙŠ ÙŠØ³ØªÙˆØ±Ø¯ API_BASE_URL) Ø¨Ø§Ù„Ø¹Ù…Ù„ Ø¨Ù‚ÙŠÙمØ© Ù…ÙØ±Ù‚Ù‘Ø§Ø©
export const API_BASE_URL = EFFECTIVE_API_BASE_URL;

// Ù‡Ù„ Ø§Ù„Ù€ API Ù…Ø­Ù„ÙŠØŸ
const isLocalhostApi = /^https?:\/\/localhost(?::\d+)?/i.test(
  API_BASE_URL.replace(/\/api\/?$/, '')
);

/** ÙÙ„Ø§Øº Ù„Ù„ØªØ­ÙƒÙ… Ø¨Ø·Ù„Ø¨ "ØªÙƒØ§Ù„ Ø§Ù„Ø·Ù„Ø¨":
 * - ÙŠÙ‚Ø±Ø£ Ù…Ù† NEXT_PUBLIC_ORDERS_DETAILS_ENABLED
 * - Ø¥Ù† Ù„Ù… ÙŠØ­Ø¯ÙŽÙ‘Ø¯ØŒ Ù†Ø¹Ø·Ù„Ù‡Ø§ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ù¹Ù†Ø¯Ù…Ø§ ÙŠÙƒÙˆÙ† Ø§Ù„Ù€ API Ù…Ø­Ù„ÙŠÙ‹Ø§ Ù„ØªØ¬Ù†Ù‘Ø¨ 404
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
    login: '/auth/login',
    register: '/auth/register',
    registerContext: 'auth/register-context',
    profile: '/users/profile',
    changePassword: '/auth/change-password',
  forgotPassword: '/auth/password/forgot',
  resetPassword: '/auth/password/reset',
  },

  users: {
    base: `${EFFECTIVE_API_BASE_URL}/users`,
    register: `${EFFECTIVE_API_BASE_URL}/users/register`,
    profile: `${EFFECTIVE_API_BASE_URL}/users/profile`,
    me: `${EFFECTIVE_API_BASE_URL}/users/profile`,
    profileWithCurrency: `${EFFECTIVE_API_BASE_URL}/users/profile-with-currency`,
    byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}`,
    withPriceGroup: `${EFFECTIVE_API_BASE_URL}/users/with-price-group`,
  toggleActive: (id: string) => `${EFFECTIVE_API_BASE_URL}/users/${id}`,
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
    base: `${EFFECTIVE_API_BASE_URL}/currencies/`,
    create: `${EFFECTIVE_API_BASE_URL}/currencies/`,
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
  topup: `${EFFECTIVE_API_BASE_URL}/admin/deposits/topup`,
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
      capital: `${EFFECTIVE_API_BASE_URL}/admin/reports/capital`,
      capitalAdjustments: {
        base: `${EFFECTIVE_API_BASE_URL}/admin/reports/capital/adjustments`,
        byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/reports/capital/adjustments/${id}`,
      },
    },

    tenants: {
      list: (p?: { status?: 'active'|'trashed'|'all'; page?: number; limit?: number; search?: string }) => {
        const base = `${EFFECTIVE_API_BASE_URL}/admin/tenants`;
        if (!p) return base;
        const qs = new URLSearchParams();
        if (p.status) qs.set('status', p.status);
        if (p.page) qs.set('page', String(p.page));
        if (p.limit) qs.set('limit', String(p.limit));
        if (p.search) qs.set('q', p.search);
        const s = qs.toString();
        return s ? `${base}?${s}` : base;
      },
      byId: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/tenants/${id}`,
      update: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/tenants/${id}`,
      trash: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/tenants/${id}/trash`,
      restore: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/tenants/${id}/restore`,
      hardDelete: (id: string, code: string) => `${EFFECTIVE_API_BASE_URL}/admin/tenants/${id}/hard?hard=true&confirm=${encodeURIComponent(code)}`,
    },
  },

  billing: {
    overview: `${EFFECTIVE_API_BASE_URL}/tenant/billing/overview`,
    invoices: (p?: { status?: string; overdue?: boolean }) => {
      const base = `${EFFECTIVE_API_BASE_URL}/tenant/billing/invoices`;
      if (!p) return base;
      const qs = new URLSearchParams();
      if (p.status) qs.set('status', p.status);
      if (p.overdue) qs.set('overdue', 'true');
      const s = qs.toString();
      return s ? `${base}?${s}` : base;
    },
    pay: `${EFFECTIVE_API_BASE_URL}/tenant/billing/payments/request`,
  },
  adminBilling: {
    tenants: (limit=20, offset=0) => `${EFFECTIVE_API_BASE_URL}/admin/billing/tenants?limit=${limit}&offset=${offset}`,
    invoices: (tenantId: string) => `${EFFECTIVE_API_BASE_URL}/admin/billing/tenants/${tenantId}/invoices`,
    markPaid: (id: string) => `${EFFECTIVE_API_BASE_URL}/admin/billing/invoices/${id}/mark-paid`,
    health: `${EFFECTIVE_API_BASE_URL}/admin/billing/health`,
  },

  /* ===== ØµÙØ­Ø§Øª Ø¹Ø§Ù…Ø© ÙŠÙØ­Ø±Ø±Ù‡Ø§ Ø§Ù„Ø£Ø¯Ù…Ù† (Ù…Ù† Ù†Ø­Ù† / ØªØ¹Ù„ÙŠÙ…Ø§Øª) ===== */
  site: {
    public: {
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: /user/about */
  about: `${EFFECTIVE_API_BASE_URL}/pages/about`,
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: /user/infoes */
  infoes: `${EFFECTIVE_API_BASE_URL}/pages/infoes`,
      /** شريط إعلان عام يظهر أعلى الهيدر (GET فقط) */
      banner: `${EFFECTIVE_API_BASE_URL}/pages/banner`,
    },
    admin: {
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ Ù„ÙˆØ­Ø© Ø§Ù„Ø£Ø¯Ù…Ù† (Ù‚Ø³Ù… "Ù…Ù† Ù†Ø­Ù†"): GET/PUT Ù†Øµ ÙƒØ¨ÙŠØ± */
  about: `${EFFECTIVE_API_BASE_URL}/admin/settings/about`,
      /** ØªÙØ³ØªØ®Ø¯Ù… ÙÙŠ Ù„ÙˆØ­Ø© Ø§Ù„Ø£Ø¯Ù…Ù† (Ù‚Ø³Ù… "ØªØ¹Ù„ÙŠÙ…Ø§Øª"): GET/PUT Ù†Øµ ÙƒØ¨ÙŠØ± */
  infoes: `${EFFECTIVE_API_BASE_URL}/admin/settings/infoes`,
      /** إعدادات شريط الإعلان (GET/PUT) */
      banner: `${EFFECTIVE_API_BASE_URL}/admin/settings/banner`,
    },
  },

  /* ===== ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø¥ÙŠØ¯Ø§Ø¹Ø§Øª (Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…) ===== */
  payments: {
    methods: {
      active: `${EFFECTIVE_API_BASE_URL}/payment-methods/active`,
    },
    deposits: {
      base: `${EFFECTIVE_API_BASE_URL}/deposits`,    // GET قائمة/ POST إنشاء
      create: `${EFFECTIVE_API_BASE_URL}/deposits`,  // POST /deposits
      mine: `${EFFECTIVE_API_BASE_URL}/deposits/me`,
      legacyMine: `${EFFECTIVE_API_BASE_URL}/deposits/mine`, // توافق مسارات قديمة
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
  ,
  seed: `${EFFECTIVE_API_BASE_URL}/dev/seed-products`,
  filteredSync: `${EFFECTIVE_API_BASE_URL}/dev/filtered-products-sync`,
  filteredStatus: `${EFFECTIVE_API_BASE_URL}/dev/filtered-products-sync/status`,
  filteredRepair: `${EFFECTIVE_API_BASE_URL}/dev/filtered-products-sync/repair`,
  },
};

/* =========================
   Ù†Ø³Ø®Ø© axios + Interceptors
   ========================= */

const api = axios.create({
  baseURL: EFFECTIVE_API_BASE_URL, // هذا ينتهي بـ /api
  headers: { 
    'Content-Type': 'application/json',
    'X-Tenant-Host': 'alsham.localhost'
  },
  // ضروري لإرسال كوكي auth (SameSite=None) عبر الدومين api.<root>
  withCredentials: true,
});

// ===== Simplified single-run profile fetch (no retry/backoff) =====
let __profilePromise: Promise<any> | null = null;
let __profileFailed = false;
let __profileRedirected = false;

function handleProfileFailure(err: any) {
  if (typeof window === 'undefined') return;
  if (__profileRedirected) return; // avoid multiple redirects
  const status = err?.response?.status;
  // Treat auth / not found of profile as invalid session -> logout & redirect
  if ([401, 403, 404].includes(status)) {
    try { localStorage.removeItem('token'); } catch {}
    try { localStorage.removeItem('user'); } catch {}
    try { localStorage.removeItem('auth'); } catch {}
    try { document.cookie = 'tenant_host=; Max-Age=0; path=/'; } catch {}
    __profileRedirected = true;
    const cause = status === 404 ? 'profile_404' : 'auth';
    // لا تقم بإعادة توجيه إذا كنا بالفعل على /login
    const currentPath = window.location.pathname + (window.location.search || '');
    if (!/\/login\/?(\?.*)?$/.test(currentPath)) {
      const url = `/login/?cause=${cause}`; // أضف الشرطة المائلة لتوافق trailingSlash
      // Use replace so back button doesn't loop
      setTimeout(() => { window.location.replace(url); }, 50);
    }
  }
}

function fetchProfileOnce(endpoint: string) {
  if (__profilePromise) return __profilePromise;
  __profilePromise = api.get(endpoint)
    .then(res => res)
    .catch(err => {
      __profileFailed = true;
      handleProfileFailure(err);
      throw err;
    });
  return __profilePromise;
}

// Utilities to allow context / callers to explicitly refresh the cached profile
export function resetProfileCache() {
  __profilePromise = null;
  __profileFailed = false;
  __profileRedirected = false;
}

export async function forceProfileRefresh(endpoint: string = '/users/profile-with-currency') {
  resetProfileCache();
  return fetchProfileOnce(endpoint);
}

// Ensure API paths have a trailing slash to avoid redirect loops with DRF/Next
function ensureApiTrailingSlash(u?: string): string | undefined {
  if (!u || typeof u !== 'string') return u;
  try {
    // Some auth endpoints on Django are defined WITHOUT trailing slash
    // and will 404 if we append one. Skip normalization for them.
  const shouldSkip = (p: string) => {
      // Handle both absolute and relative forms
      // Examples:
      //   /api-dj/auth/login
      //   http://127.0.0.1:8000/api-dj/auth/login
      //   <API_BASE>/auth/login
      const lower = p.toLowerCase();
      return (
        lower.endsWith('/auth/login') ||
        lower.endsWith('/auth/refresh') ||
  lower.endsWith('/auth/register') ||
        lower.endsWith('/auth/register-context') ||
        // Users profile endpoints
        lower.endsWith('/users/profile') ||
        lower.endsWith('/users/profile-with-currency') ||
        lower.endsWith('/users/with-price-group') ||
        /\/users\/[0-9a-f-]{36}\/price-group$/i.test(lower) ||
        // Dev/public note
        lower.endsWith('/dev/notes/public/latest') ||
        // Admin small counters
        lower.endsWith('/admin/pending-orders-count') ||
        lower.endsWith('/admin/pending-deposits-count') ||
  // Admin codes endpoints (no trailing slash)
  lower.endsWith('/admin/codes/groups') ||
  lower.includes('/admin/codes/groups/') ||
  lower.includes('/admin/codes/items/') ||
        // Admin integrations endpoints are defined without trailing slashes in Django
        lower.endsWith('/admin/integrations') ||
        lower.includes('/admin/integrations/') ||
        // Products exact endpoints defined without trailing slash in Django
        lower.endsWith('/products/price-groups') ||
        lower.includes('/products/price-groups/') ||
        // product detail, and nested endpoints will manage their own slashes
        /\/products\/[0-9a-f-]{36}$/i.test(lower)
      );
    };

    // Accept both absolute (http...) and relative (/api-dj/...) URLs
    const hasQuery = u.includes('?');
    const [path, query] = hasQuery ? [u.slice(0, u.indexOf('?')), u.slice(u.indexOf('?'))] : [u, ''];
    // Only adjust for our API base prefixes
    const isApiDj = path.startsWith('/api-dj/');
    const isApiAbs = path.startsWith(EFFECTIVE_API_BASE_URL + '/');
    if (!(isApiDj || isApiAbs)) return u;
    // Skip known no-trailing-slash endpoints
    if (shouldSkip(path)) return u;
    // Ignore if it already ends with '/'
    if (path.endsWith('/')) return u;
    // Ignore likely file assets (has extension)
    if (/\.[a-zA-Z0-9]{1,6}$/.test(path)) return u;
    return path + '/' + (query || '');
  } catch { return u; }
}

// Convenience high-level methods (avoid scattering relative /api calls)
export type TenantAwareRequestConfig = AxiosRequestConfig & { skipAuth?: boolean };

export const Api = {
  client: api,
  // baseURL يحتوي /api بالفعل، فلا نضيف /api هنا
  // Prefer simplified profile-with-currency endpoint (lighter joins, robust fallbacks)
  me: () => fetchProfileOnce('/users/profile-with-currency'),
  logout: async () => {
    try {
      const res = await api.post('/auth/logout');
      
      const cookieNames = ['auth', 'access_token', 'role', 'tenant_host', 'refresh_token'];
  const domains = [window.location.hostname, `.${window.location.hostname}`, '.wtn4.com', 'api.wtn4.com'];
      const paths = ['/', '/api'];
      
      for (const name of cookieNames) {
        for (const domain of domains) {
          for (const path of paths) {
            try {
              document.cookie = `${name}=; Max-Age=0; path=${path}; domain=${domain}; secure; SameSite=None`;
            } catch {}
          }
        }
      }
      
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth');
      } catch {}
      
      console.log('[API] logout: cleared all authentication data');
      return res;
    } catch (e) {
      console.warn('[API] logout: server logout failed, clearing cookies anyway');
      
      const cookieNames = ['auth', 'access_token', 'role', 'tenant_host', 'refresh_token'];
  const domains = [window.location.hostname, `.${window.location.hostname}`, '.wtn4.com', 'api.wtn4.com'];
      const paths = ['/', '/api'];
      
      for (const name of cookieNames) {
        for (const domain of domains) {
          for (const path of paths) {
            try {
              document.cookie = `${name}=; Max-Age=0; path=${path}; domain=${domain}; secure; SameSite=None`;
            } catch {}
          }
        }
      }
      
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth');
      } catch {}
      
      throw e;
    }
  },
  admin: {
    pendingOrders: () => api.get('/admin/pending-orders-count'),
    pendingDeposits: () => api.get('/admin/pending-deposits-count'),
  },
  users: {
  profile: () => fetchProfileOnce('/users/profile'),
  profileWithCurrency: () => fetchProfileOnce('/users/profile-with-currency'),
  }
};

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
function addTenantHeaders(config: any): any {
  config.headers = config.headers || {};

  const skipAuth = Boolean(config?.skipAuth);

  if (skipAuth) {
    if (config.headers.Authorization) delete config.headers.Authorization;
    if (config.headers.authorization) delete config.headers.authorization;
  }

  // 1) Ø­Ø§ÙˆÙ„ Ø£Ø®Ø° subdomain Ù…Ù† Ø§Ù„ÙƒÙˆÙƒÙŠ (ÙŠÙÙŠØ¯ Ø£Ø«Ù†Ø§Ø¡ SSR Ø£Ùˆ Ù‚Ø¨Ù„ ØªÙˆÙØ± window)
  const tenantCookie = getCookie('tenant_host');
  if (tenantCookie) {
    config.headers['X-Tenant-Host'] = tenantCookie; // always set/overwrite from cookie early if present
  }
  // 1.b) Fallback to env-provided tenant when cookie missing (useful on plain localhost)
  if (!config.headers['X-Tenant-Host']) {
    const envTenant = process.env.NEXT_PUBLIC_TENANT_HOST;
    if (envTenant) {
      config.headers['X-Tenant-Host'] = envTenant;
      try { if (typeof document !== 'undefined') document.cookie = `tenant_host=${envTenant}; path=/`; } catch {}
    }
  }

  // 2) ÙÙŠ Ø§Ù„Ù…ØªØµÙØ­: Ø§Ø³ØªØ®Ø±Ø¬ Ù…Ø¨Ø§ØšØ±Ø© Ù…Ù† window.host ÙˆØ­Ø¯Ø« Ø§Ù„ÙƒÙˆÙƒÙŠ Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù„Ø§Ø­Ù‚Ø§Ù‹
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;          // Ù…Ø«Ø§Ù„: saeed.localhost:3000
    if (currentHost.includes('.localhost')) {
      const sub = currentHost.split('.')[0];
      if (sub && sub !== 'localhost' && sub !== 'www') {
        const tenantHost = `${sub}.localhost`;
  config.headers['X-Tenant-Host'] = tenantHost;
        // Ø®Ø²Ù‘Ù†Ù‡ Ø¨ÙˆÙ† ØƒÙˆÙƒÙŠ Ø„ÙŠØ³ØªÙÙŠØ¯ Ù…Ù†Ù‡ Ø£ÙŠ Ø·Ù„Ø¨ ÙŠØªÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± (SSR) Ø£Ùˆ fetch Ø¨Ø¯ÙˆÙ† window Ù„Ø§Ø­Ù‚Ø§Ù‹
        document.cookie = `tenant_host=${tenantHost}; path=/`;
      }
    }
  // Production multi-tenant: *.wtn4.com (exclude bare root, www, api)
  else if (/\.wtn4\.com$/i.test(currentHost)) {
      const hostParts = currentHost.split('.');
      if (hostParts.length > 2) {
        const sub = hostParts[0].toLowerCase();
        if (!['www', 'api'].includes(sub)) {
          config.headers['X-Tenant-Host'] = currentHost;
          document.cookie = `tenant_host=${currentHost}; path=/`;
        }
      }
    }
  }

  // 3) Ø§Ù„ØªÙˆÙƒÙ†
  if (!skipAuth) {
    if (typeof window !== 'undefined') {
      let token: string | null = localStorage.getItem('token');
      if (!token) token = getCookie('access_token');
      if (!token) token = getCookie('auth'); // legacy/httpOnly support
      if (token) {
        config.headers.Authorization = `Bearer ${token}`; // always overwrite to keep fresh token
      }
    }
  }

  if ('skipAuth' in config) {
    delete config.skipAuth;
  }

  return config;
}
// Patch Ù„Ù„Ù€ fetch Ù„ØªØºØ·ÙŠØ© Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ØªÙŠ Ù„Ø§ ØªÙ…Ø± Ø¹Ø¨Ø± axios
if (typeof window !== 'undefined' && !(window as { __TENANT_FETCH_PATCHED__?: boolean }).__TENANT_FETCH_PATCHED__) {
  (window as { __TENANT_FETCH_PATCHED__?: boolean }).__TENANT_FETCH_PATCHED__ = true;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const newInit: RequestInit = init ? { ...init } : {};
    const headers = new Headers(newInit.headers || (typeof input === 'object' && (input as { headers?: HeadersInit }).headers) || {});
    // طبيعـة الشرطة المائلة لمسارات API الشائعة
    if (typeof input === 'string' || input instanceof URL) {
      let s = String(input);
      // Keep relative /api-dj/* so Next.js rewrites and headers can apply
      // (do not rewrite to EFFECTIVE_API_BASE_URL here to preserve same-origin in dev)
      // if (s.startsWith('/api-dj/')) {
      //   s = EFFECTIVE_API_BASE_URL + s.slice('/api-dj'.length);
      // }
      const hasQuery = s.includes('?');
      const path = hasQuery ? s.slice(0, s.indexOf('?')) : s;
      // Skip adding slash for endpoints defined without trailing slash
      const lower = path.toLowerCase();
      const skipSlash = (
        lower.endsWith('/auth/login') ||
        lower.endsWith('/auth/refresh') ||
        lower.endsWith('/auth/register-context') ||
        lower.endsWith('/health') ||
        lower.endsWith('/users/profile') ||
        lower.endsWith('/users/profile-with-currency') ||
        lower.endsWith('/users/with-price-group') ||
        /\/users\/[0-9a-f-]{36}\/price-group$/i.test(lower) ||
        lower.endsWith('/dev/notes/public/latest') ||
        lower.endsWith('/admin/pending-orders-count') ||
        lower.endsWith('/admin/pending-deposits-count') ||
        lower.endsWith('/admin/codes/groups') ||
        lower.includes('/admin/codes/groups/') ||
        lower.includes('/admin/codes/items/') ||
        lower.endsWith('/admin/integrations') ||
        lower.includes('/admin/integrations/') ||
        lower.endsWith('/products/price-groups') ||
        lower.includes('/products/price-groups/') ||
        /\/products\/[0-9a-f-]{36}$/i.test(lower)
      );
      if (!skipSlash && (path.startsWith('/api-dj/') || path.startsWith(API_BASE_URL + '/')) &&
          !path.endsWith('/') && !/\.[a-zA-Z0-9]{1,6}(?:$|\?)/.test(path)) {
        s = path + '/' + (hasQuery ? s.slice(s.indexOf('?')) : '');
      }
      input = s;
    }

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
  } else if (/\.wtn4\.com$/i.test(h)) {
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
      // Fallback to NEXT_PUBLIC_TENANT_HOST when running on plain localhost
      if (!headers.has('X-Tenant-Host')) {
        const envTenant = process.env.NEXT_PUBLIC_TENANT_HOST;
        if (envTenant) {
          headers.set('X-Tenant-Host', envTenant);
          try { document.cookie = `tenant_host=${envTenant}; path=/`; } catch {}
          console.log(`[FETCH] Setting X-Tenant-Host header (env): ${envTenant}`);
        }
      }
    }

    // Ø£Ø¶Ù Ø§Ù„ØªÙˆÙƒÙ† Ø¥Ù† Ù„Ù… ÙŠÙƒÙ† Ù…ÙˆØ¬ÙˆØ¯Ø§Ù‹
    if (!headers.has('Authorization')) {
      let token: string | null = localStorage.getItem('token');
  if (!token) token = getCookie('access_token');
  if (!token) token = getCookie('auth');
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    newInit.headers = headers;
    return originalFetch(input, newInit);
  };
}
// ØªØ£ÙƒØ¯ Ù…Ù† Ø¹Ø¯Ù… ØªÙƒØ±Ø§Ø± ØªØ³Ø¬ÙŠÙ„ Ù†ÙØ³ Ø§Ù„Ù€ interceptor (Ù†ÙØ­Øµ flag Ø¹Ù„Ù‰ axios Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠ)
const ANY_AXIOS = axios as typeof axios & { __TENANT_HEADERS_ATTACHED__?: boolean };
function stripDuplicatePrefix(url?: string): string | undefined {
  if (!url) return url;
  try {
    // Only normalize relative URLs that start with the effective base
    if (EFFECTIVE_API_BASE_URL && url.startsWith(EFFECTIVE_API_BASE_URL + '/')) {
      return url.slice(EFFECTIVE_API_BASE_URL.length);
    }
  } catch {}
  return url;
}
if (!ANY_AXIOS.__TENANT_HEADERS_ATTACHED__) {
  ANY_AXIOS.__TENANT_HEADERS_ATTACHED__ = true;
  api.interceptors.request.use((config) => {
    // Avoid /api-dj/api-dj/* when callers pass full API_ROUTES URLs
    if (typeof config.url === 'string') {
      let u = stripDuplicatePrefix(config.url);
      u = ensureApiTrailingSlash(u);
      // وإذا كانت المسارات نسبية (مثل '/products') مع baseURL = '/api-dj' أضف الشرطة المائلة الأخيرة أيضًا
      if (EFFECTIVE_API_BASE_URL === '/api-dj' || EFFECTIVE_API_BASE_URL.endsWith('/api-dj')) {
        if (typeof u === 'string' && u.startsWith('/') &&
            !u.startsWith('/api-dj') && !u.startsWith('/_next') && !u.startsWith('/api') &&
            !/\.[a-zA-Z0-9]{1,6}(?:$|\?)/.test(u)) {
          // Skip auth endpoints that must NOT have trailing slash
          const lower = u.toLowerCase();
          const skip = (
            lower.endsWith('/auth/login') ||
            lower.endsWith('/auth/refresh') ||
            lower.endsWith('/auth/register') ||
            lower.endsWith('/auth/register-context') ||
            lower.endsWith('/health') ||
            lower.endsWith('/users/profile') ||
            lower.endsWith('/users/profile-with-currency') ||
            lower.endsWith('/users/with-price-group') ||
            /\/users\/[0-9a-f-]{36}\/price-group$/i.test(lower) ||
            lower.endsWith('/dev/notes/public/latest') ||
            lower.endsWith('/admin/pending-orders-count') ||
            lower.endsWith('/admin/pending-deposits-count') ||
            lower.endsWith('/admin/codes/groups') ||
            lower.includes('/admin/codes/groups/') ||
            lower.includes('/admin/codes/items/') ||
            lower.endsWith('/admin/integrations') ||
            lower.includes('/admin/integrations/') ||
            lower.endsWith('/products/price-groups') ||
            lower.includes('/products/price-groups/') ||
            /\/products\/[0-9a-f-]{36}$/i.test(lower)
          );
          // ضع الشرطة قبل الاستعلام إن وُجد
          if (!skip && !u.endsWith('/')) {
            if (u.includes('?')) {
              const idx = u.indexOf('?');
              u = u.slice(0, idx) + '/' + u.slice(idx);
            } else {
              u = u + '/';
            }
          }
        }
      }
      config.url = u;
    }
    // console.log(`[API] -> ${config.method} ${config.url}`);
    return addTenantHeaders(config);
  });
  axios.interceptors.request.use((config) => {
    if (typeof config.url === 'string') {
      config.url = ensureApiTrailingSlash(stripDuplicatePrefix(config.url));
    }
    return addTenantHeaders(config);
  });
}

// src/utils/api.ts â€” Ø¯Ø§Ø®Ù„ interceptor Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„Ø§Ø³ØªØ¬Ø§Ø¨Ø©
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    if (typeof window !== 'undefined') {
      if (code === 'TENANT_MISMATCH') {
        try { localStorage.removeItem('token'); } catch {}
        try { document.cookie = 'tenant_host=; Max-Age=0; path=/'; } catch {}
        const current = window.location.pathname || '/';
        if (!/login/.test(current)) {
          const currentPath = window.location.pathname + (window.location.search || '');
          if (!/\/login\/?(\?.*)?$/.test(currentPath)) {
            const url = '/login/?cause=tenant_mismatch';
            window.location.replace(url);
          }
        }
      } else if (status === 401) {
        const p = window.location.pathname || '';
  const inBackoffice = p.startsWith('/admin') || p.startsWith('/dev');
  const onAuthPages  = /^\/(login|register)(\/|$)/.test(p);
        if (!inBackoffice && !onAuthPages) {
          try { localStorage.removeItem('token'); } catch {}
          if (!/\/login\/?$/.test(p)) {
            window.location.assign('/login/');
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

