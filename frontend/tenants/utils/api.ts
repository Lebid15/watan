import { mockApi } from './mockApi';

export default mockApi;

export const API_BASE_URL = 'http://localhost:8000/api-dj';

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
    base: `${API_BASE_URL}/users`,
    register: `${API_BASE_URL}/users/register`,
    profile: `${API_BASE_URL}/users/profile`,
    me: `${API_BASE_URL}/users/profile`,
    profileWithCurrency: `${API_BASE_URL}/users/profile-with-currency`,
    byId: (id: string) => `${API_BASE_URL}/users/${id}`,
    withPriceGroup: `${API_BASE_URL}/users/with-price-group`,
    toggleActive: (id: string) => `${API_BASE_URL}/users/${id}`,
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
    base: `${API_BASE_URL}/currencies/`,
    create: `${API_BASE_URL}/currencies/`,
    byId: (id: string) => `${API_BASE_URL}/currencies/${id}`,
    bulkUpdate: `${API_BASE_URL}/currencies/bulk-update`,
  },
  orders: {
    base: `${API_BASE_URL}/orders`,
    mine: `${API_BASE_URL}/orders/me`,
    byId: (id: string) => `${API_BASE_URL}/orders/${id}`,
    detailsEnabled: true,
    _alts: [],
  },
  adminOrders: {
    base: `${API_BASE_URL}/admin/orders`,
    list: `${API_BASE_URL}/admin/orders`,
    byId: (id: string) => `${API_BASE_URL}/admin/orders/${id}`,
    audit: (id: string) => `${API_BASE_URL}/admin/orders/${id}/audit`,
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
  admin: {
    upload: `${API_BASE_URL}/admin/upload`,
    paymentMethods: {
      base: `${API_BASE_URL}/admin/payment-methods`,
      upload: `${API_BASE_URL}/admin/upload`,
      byId: (id: string) => `${API_BASE_URL}/admin/payment-methods/${id}`,
    },
    deposits: {
      base: `${API_BASE_URL}/admin/deposits`,
      setStatus: (id: string) => `${API_BASE_URL}/admin/deposits/${id}/status`,
      list: (p?: Record<string, string | number | boolean>) => `${API_BASE_URL}/admin/deposits`,
      topup: `${API_BASE_URL}/admin/deposits/topup`,
    },
    integrations: {
      base: `${API_BASE_URL}/admin/integrations`,
      byId: (id: string) => `${API_BASE_URL}/admin/integrations/${id}`,
      test: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/test`,
      refreshBalance: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/refresh-balance`,
      balance: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/balance`,
      packages: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/packages`,
      syncProducts: (id: string) => `${API_BASE_URL}/admin/integrations/${id}/sync-products`,
      providerCost: `${API_BASE_URL}/admin/integrations/provider-cost`,
      routingAll: (q?: string) => `${API_BASE_URL}/admin/integrations/routing/all`,
      routingSet: `${API_BASE_URL}/admin/integrations/routing/set`,
      routingSetType: `${API_BASE_URL}/admin/integrations/routing/set-type`,
      routingSetCodeGroup: `${API_BASE_URL}/admin/integrations/routing/set-code-group`,
    },
    reports: {
      profits: `${API_BASE_URL}/admin/reports/profits`,
      users: `${API_BASE_URL}/admin/reports/users`,
      providers: `${API_BASE_URL}/admin/reports/providers`,
      capital: `${API_BASE_URL}/admin/reports/capital`,
      capitalExport: `${API_BASE_URL}/admin/reports/capital/export.xlsx`,
      capitalAdjustments: {
        base: `${API_BASE_URL}/admin/reports/capital/adjustments`,
        byId: (id: string) => `${API_BASE_URL}/admin/reports/capital/adjustments/${id}`,
      },
    },
    tenants: {
      list: (p?: any) => `${API_BASE_URL}/admin/tenants`,
      byId: (id: string) => `${API_BASE_URL}/admin/tenants/${id}`,
      update: (id: string) => `${API_BASE_URL}/admin/tenants/${id}`,
      trash: (id: string) => `${API_BASE_URL}/admin/tenants/${id}/trash`,
      restore: (id: string) => `${API_BASE_URL}/admin/tenants/${id}/restore`,
      hardDelete: (id: string, code: string) => `${API_BASE_URL}/admin/tenants/${id}/hard`,
    },
  },
  billing: {
    overview: `${API_BASE_URL}/tenant/billing/overview`,
    invoices: (p?: any) => `${API_BASE_URL}/tenant/billing/invoices`,
    pay: `${API_BASE_URL}/tenant/billing/payments/request`,
  },
  adminBilling: {
    tenants: (limit = 20, offset = 0) => `${API_BASE_URL}/admin/billing/tenants`,
    invoices: (tenantId: string) => `${API_BASE_URL}/admin/billing/tenants/${tenantId}/invoices`,
    markPaid: (id: string) => `${API_BASE_URL}/admin/billing/invoices/${id}/mark-paid`,
    health: `${API_BASE_URL}/admin/billing/health`,
  },
  site: {
    public: {
      about: `${API_BASE_URL}/pages/about`,
      infoes: `${API_BASE_URL}/pages/infoes`,
      banner: `${API_BASE_URL}/pages/banner`,
    },
    admin: {
      about: `${API_BASE_URL}/admin/settings/about`,
      infoes: `${API_BASE_URL}/admin/settings/infoes`,
      banner: `${API_BASE_URL}/admin/settings/banner`,
    },
  },
  payments: {
    methods: {
      active: `${API_BASE_URL}/payment-methods/active`,
    },
    deposits: {
      base: `${API_BASE_URL}/deposits`,
      create: `${API_BASE_URL}/deposits`,
      mine: `${API_BASE_URL}/deposits/me`,
      legacyMine: `${API_BASE_URL}/deposits/mine`,
    },
  },
  dashboard: {
    announcements: {
      base: `${API_BASE_URL}/dashboard/announcements`,
      list: `${API_BASE_URL}/dashboard/announcements/`,
      active: `${API_BASE_URL}/dashboard/announcements/active/`,
      stats: `${API_BASE_URL}/dashboard/announcements/stats/`,
      byId: (id: string) => `${API_BASE_URL}/dashboard/announcements/${id}/`,
    },
  },
  dev: {
    errors: {
      ingest: `${API_BASE_URL}/dev/errors/ingest`,
      list: (p?: any) => `${API_BASE_URL}/dev/errors`,
      byId: (id: string) => `${API_BASE_URL}/dev/errors/${id}`,
      resolve: (id: string) => `${API_BASE_URL}/dev/errors/${id}/resolve`,
      delete: (id: string) => `${API_BASE_URL}/dev/errors/${id}`,
    },
    seed: `${API_BASE_URL}/dev/seed-products`,
    filteredSync: `${API_BASE_URL}/dev/filtered-products-sync`,
    filteredStatus: `${API_BASE_URL}/dev/filtered-products-sync/status`,
    filteredRepair: `${API_BASE_URL}/dev/filtered-products-sync/repair`,
  },
};

export const ORDERS_DETAILS_ENABLED = true;

export const Api = {
  client: mockApi,
  me: () => mockApi.get('/users/profile-with-currency'),
  logout: async () => mockApi.post('/auth/logout'),
  admin: {
    pendingOrders: () => mockApi.get('/admin/pending-orders-count'),
    pendingDeposits: () => mockApi.get('/admin/pending-deposits-count'),
  },
  users: {
    profile: () => mockApi.get('/users/profile'),
    profileWithCurrency: () => mockApi.get('/users/profile-with-currency'),
  },
};

export function resetProfileCache() {
  console.log('[MOCK API] resetProfileCache called');
}

export async function forceProfileRefresh(endpoint?: string) {
  console.log('[MOCK API] forceProfileRefresh called');
  return mockApi.get(endpoint || '/users/profile-with-currency');
}
