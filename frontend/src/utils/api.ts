// src/utils/api.ts
import axios from 'axios';

/* =========================
   إعدادات وبيئة التشغيل
   ========================= */

// عنوان الـ API (مثال محلي: http://localhost:3001/api)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

// هل الـ API محلي؟
const isLocalhostApi = /^https?:\/\/localhost(?::\d+)?/i.test(
  API_BASE_URL.replace(/\/api\/?$/, '')
);

/** فلاغ للتحكم بطلب "تفاصيل الطلب":
 * - يقرأ من NEXT_PUBLIC_ORDERS_DETAILS_ENABLED
 * - إن لم يحدَّد، نعطلها تلقائيًا عندما يكون الـ API محليًا لتجنّب 404
 */
export const ORDERS_DETAILS_ENABLED = (() => {
  const v = process.env.NEXT_PUBLIC_ORDERS_DETAILS_ENABLED;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return !isLocalhostApi; // افتراضي: عطّل محليًا، فعِّل في الإنتاج
})();

/** قراءة بدائل مسارات (alts) من env:
 * NEXT_PUBLIC_ORDERS_ALTS يمكن أن تكون JSON Array أو قائمة مفصولة بفواصل
 * مثال: '["/api/orders/me"]' أو '/api/orders/me'
 */
function parseAltsEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // ليس JSON — اعتبره قائمة بفواصل
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ORDERS_ALTS = parseAltsEnv('NEXT_PUBLIC_ORDERS_ALTS');

/* =========================
   تعريف المسارات
   ========================= */

export const API_ROUTES = {
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    register: `${API_BASE_URL}/auth/register`,
    profile: `${API_BASE_URL}/users/profile`,
    changePassword: `${API_BASE_URL}/auth/change-password`,
  forgotPassword: `${API_BASE_URL}/auth/password/forgot`,
  resetPassword: `${API_BASE_URL}/auth/password/reset`,
    passkeys: {
      list: `${API_BASE_URL}/auth/passkeys`,
      regOptions: `${API_BASE_URL}/auth/passkeys/registration/options`,
      regVerify: `${API_BASE_URL}/auth/passkeys/registration/verify`,
      authOptions: `${API_BASE_URL}/auth/passkeys/authentication/options`,
      authVerify: `${API_BASE_URL}/auth/passkeys/authentication/verify`,
      delete: (id: string) => `${API_BASE_URL}/auth/passkeys/${id}`,
    },
  },

  users: {
    base: `${API_BASE_URL}/users`,
    register: `${API_BASE_URL}/users/register`,
    profile: `${API_BASE_URL}/users/profile`,
    me: `${API_BASE_URL}/users/profile`,
    profileWithCurrency: `${API_BASE_URL}/users/profile-with-currency`,
    byId: (id: string) => `${API_BASE_URL}/users/${id}`,
    withPriceGroup: `${API_BASE_URL}/users/with-price-group`,
    toggleActive: (id: string) => `${API_BASE_URL}/users/${id}/active`,
    addFunds: (id: string) => `${API_BASE_URL}/users/${id}/balance/add`,
    setPassword: (id: string) => `${API_BASE_URL}/users/${id}/password`,
    setOverdraft: (id: string) => `${API_BASE_URL}/users/${id}/overdraft`,
  },

  products: {
    base: `${API_BASE_URL}/products`,
    byId: (id: string) => `${API_BASE_URL}/products/${id}`,
    priceGroups: `${API_BASE_URL}/products/price-groups`,
  },

  priceGroups: {
    base: `${API_BASE_URL}/products/price-groups`,
    create: `${API_BASE_URL}/products/price-groups`,
    byId: (id: string) => `${API_BASE_URL}/products/price-groups/${id}`,
  },

  currencies: {
    base: `${API_BASE_URL}/currencies`,
    create: `${API_BASE_URL}/currencies`,
    byId: (id: string) => `${API_BASE_URL}/currencies/${id}`,
    bulkUpdate: `${API_BASE_URL}/currencies/bulk-update`,
  },

  /* ===== طلبات المستخدم ===== */
  orders: {
    base: `${API_BASE_URL}/orders`,
    mine: `${API_BASE_URL}/orders/me`,
    byId: (id: string) => `${API_BASE_URL}/orders/${id}`,
    /** يقرأه الكلاينت ليتخذ قرار جلب التفاصيل أو لا */
    detailsEnabled: ORDERS_DETAILS_ENABLED,
    /** بدائل لمسارات (مثلاً /orders/me) إن رغبت في التجربة */
    _alts: ORDERS_ALTS,
  },

  /* ===== طلبات الإدمن ===== */
  adminOrders: {
    base: `${API_BASE_URL}/admin/orders`,
    list: `${API_BASE_URL}/admin/orders`,
    byId: (id: string) => `${API_BASE_URL}/admin/orders/${id}`,
    bulkManual: `${API_BASE_URL}/admin/orders/bulk/manual`,
    bulkDispatch: `${API_BASE_URL}/admin/orders/bulk/dispatch`,
    bulkApprove: `${API_BASE_URL}/admin/orders/bulk/approve`,
    bulkReject: `${API_BASE_URL}/admin/orders/bulk/reject`,
  },

  notifications: {
    my: `${API_BASE_URL}/notifications/my`,
    readAll: `${API_BASE_URL}/notifications/read-all`,
    readOne: (id: string) => `${API_BASE_URL}/notifications/${id}/read`,
    announce: `${API_BASE_URL}/notifications/announce`,
  },

  /* ===== إعدادات ولوحة تحكم الإدمن ===== */
  admin: {
    upload: `${API_BASE_URL}/admin/upload`,

    catalog: {
      listProducts: (withCounts = false, q?: string) => {
        const base = `${API_BASE_URL}/admin/catalog/products`;
        const params = new URLSearchParams();
        if (withCounts) params.set('withCounts', '1');
        if (q?.trim()) params.set('q', q.trim());
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
      },
      setProductImage: (id: string) => `${API_BASE_URL}/admin/catalog/products/${id}/image`,
      enableProvider: (providerId: string) => `${API_BASE_URL}/admin/catalog/providers/${providerId}/enable-all`,
      refreshPrices: (providerId: string) => `${API_BASE_URL}/admin/catalog/providers/${providerId}/refresh-prices`,
    },

    paymentMethods: {
      base: `${API_BASE_URL}/admin/payment-methods`,
      upload: `${API_BASE_URL}/admin/upload`,
      byId: (id: string) => `${API_BASE_URL}/admin/payment-methods/${id}`,
    },

    deposits: {
      base: `${API_BASE_URL}/admin/deposits`,
      setStatus: (id: string) => `${API_BASE_URL}/admin/deposits/${id}/status`,
      list: (p?: Record<string, string | number | boolean>) => {
        const base = `${API_BASE_URL}/admin/deposits`;
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
      base: `${API_BASE_URL}/admin/integrations`,
      byId: (id: string) => `${API_BASE_URL}/admin/integrations/${id}`,
      test: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/test`,
      refreshBalance: (id: string) =>
        `${API_BASE_URL}/admin/integrations/${id}/refresh-balance`,
      balance: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/balance`,
      packages: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/packages`,
      syncProducts: (id: string) =>
        `${API_BASE_URL}/admin/integrations/${id}/sync-products`,

      // تكاليف المزودين
      providerCost: `${API_BASE_URL}/admin/integrations/provider-cost`,

      // توجيه الحزم (مع دعم q اختياري)
      routingAll: (q?: string) => {
        const base = `${API_BASE_URL}/admin/integrations/routing/all`;
        const qq = q?.trim();
        return qq ? `${base}?q=${encodeURIComponent(qq)}` : base;
      },
      routingSet: `${API_BASE_URL}/admin/integrations/routing/set`,
      routingSetType: `${API_BASE_URL}/admin/integrations/routing/set-type`,
      routingSetCodeGroup: `${API_BASE_URL}/admin/integrations/routing/set-code-group`,
    },

    reports: {
      profits: `${API_BASE_URL}/admin/reports/profits`,
      users: `${API_BASE_URL}/admin/reports/users`,
      providers: `${API_BASE_URL}/admin/reports/providers`,
    },
  },

  /* ===== صفحات عامة يُحررها الأدمن (من نحن / تعليمات) ===== */
  site: {
    public: {
      /** تُستخدم في صفحات المستخدم: /user/about */
      about: `${API_BASE_URL}/pages/about`,
      /** تُستخدم في صفحات المستخدم: /user/infoes */
      infoes: `${API_BASE_URL}/pages/infoes`,
    },
    admin: {
      /** تُستخدم في لوحة الأدمن (قسم "من نحن"): GET/PUT نص كبير */
      about: `${API_BASE_URL}/admin/settings/about`,
      /** تُستخدم في لوحة الأدمن (قسم "تعليمات"): GET/PUT نص كبير */
      infoes: `${API_BASE_URL}/admin/settings/infoes`,
    },
  },

  /* ===== واجهة الإيداعات (المستخدم) ===== */
  payments: {
    methods: {
      active: `${API_BASE_URL}/payment-methods/active`,
    },
    deposits: {
      base: `${API_BASE_URL}/deposits`,    // GET قائمة/ POST إنشاء
      create: `${API_BASE_URL}/deposits`,  // POST /deposits
      mine: `${API_BASE_URL}/deposits/mine`,
    },
  },
  dev: {
    errors: {
      ingest: `${API_BASE_URL}/dev/errors/ingest`,
      list: (p?: Record<string,string|number>) => {
        const base = `${API_BASE_URL}/dev/errors`;
        if (!p) return base;
        const qs = new URLSearchParams(Object.entries(p).map(([k,v])=>[k,String(v)])).toString();
        return qs ? base+`?${qs}` : base;
      },
      byId: (id: string) => `${API_BASE_URL}/dev/errors/${id}`,
      resolve: (id: string) => `${API_BASE_URL}/dev/errors/${id}/resolve`,
      delete: (id: string) => `${API_BASE_URL}/dev/errors/${id}`,
    }
  },
};

/* =========================
   نسخة axios + Interceptors
   ========================= */

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// helper بسيط لقراءة كوكي بالاسم
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

// دالة مشتركة لإضافة headers (موحّدة)
function addTenantHeaders(config: any) {
  config.headers = config.headers || {};

  // 1) حاول أخذ subdomain من الكوكي (يفيد أثناء SSR أو قبل توفر window)
  const tenantCookie = getCookie('tenant_host');
  if (tenantCookie && !config.headers['X-Tenant-Host']) {
    config.headers['X-Tenant-Host'] = tenantCookie;
  }

  // 2) في المتصفح: استخرج مباشرة من window.host وحدث الكوكي للاستخدام لاحقاً
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;          // مثال: saeed.localhost:3000
    if (currentHost.includes('.localhost')) {
      const sub = currentHost.split('.')[0];
      if (sub && sub !== 'localhost' && sub !== 'www') {
        const tenantHost = `${sub}.localhost`;
        if (!config.headers['X-Tenant-Host']) {
          config.headers['X-Tenant-Host'] = tenantHost;
        }
        // خزّنه في كوكي ليستفيد منه أي طلب يتم على السيرفر (SSR) أو fetch بدون window لاحقاً
        document.cookie = `tenant_host=${tenantHost}; path=/`;
      }
    }
  }

  // 3) التوكن
  if (typeof window !== 'undefined') {
    let token: string | null = localStorage.getItem('token');
    if (!token) token = getCookie('access_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
}
// Patch للـ fetch لتغطية الطلبات التي لا تمر عبر axios
if (typeof window !== 'undefined' && !(window as any).__TENANT_FETCH_PATCHED__) {
  (window as any).__TENANT_FETCH_PATCHED__ = true;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const newInit: RequestInit = init ? { ...init } : {};
    const headers = new Headers(newInit.headers || (typeof input === 'object' && (input as any).headers) || {});

    // إن لم يوجد العنوان أضِفه
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
      }
    }

    // أضف التوكن إن لم يكن موجوداً
    if (!headers.has('Authorization')) {
      let token: string | null = localStorage.getItem('token');
      if (!token) token = getCookie('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    newInit.headers = headers;
    return originalFetch(input, newInit);
  };
}
// تأكد من عدم تكرار تسجيل نفس الـ interceptor (نفحص flag على axios العالمي)
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

// src/utils/api.ts — داخل interceptor الخاص بالاستجابة
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