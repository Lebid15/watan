// Mock API for tenants app - returns fake data for all endpoints

// Mock Users Data
const MOCK_USERS = [
  {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    fullName: 'أحمد محمد',
    phoneNumber: '+963123456789',
    role: 'user',
    balance: 1500.50,
    currency: { id: '1', code: 'USD' },
    isActive: true,
  },
  {
    id: '2',
    email: 'user2@example.com',
    username: 'user2',
    fullName: 'فاطمة علي',
    phoneNumber: '+963987654321',
    role: 'user',
    balance: 2300.75,
    currency: { id: '2', code: 'EUR' },
    isActive: true,
  },
  {
    id: '3',
    email: 'user3@example.com',
    username: 'user3',
    fullName: 'محمود حسن',
    phoneNumber: '+963555555555',
    role: 'user',
    balance: 500.00,
    currency: { id: '3', code: 'TRY' },
    isActive: false,
  },
  {
    id: '4',
    email: 'sara@example.com',
    username: 'sara',
    fullName: 'سارة خالد',
    phoneNumber: '+963111222333',
    role: 'user',
    balance: 800.00,
    currency: { id: '1', code: 'USD' },
    isActive: true,
  },
  {
    id: '5',
    email: 'omar@example.com',
    username: 'omar',
    fullName: 'عمر يوسف',
    phoneNumber: '+963444555666',
    role: 'user',
    balance: 1200.00,
    currency: { id: '1', code: 'USD' },
    isActive: true,
  },
  {
    id: '6',
    email: 'layla@example.com',
    username: 'layla',
    fullName: 'ليلى أحمد',
    phoneNumber: '+963777888999',
    role: 'user',
    balance: 950.00,
    currency: { id: '2', code: 'EUR' },
    isActive: true,
  },
];

// Mock Users with Price Groups
const MOCK_USERS_WITH_PRICE_GROUPS = [
  {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    priceGroup: { id: 'vip1', name: 'VIP 1' },
  },
  {
    id: '2',
    email: 'user2@example.com',
    username: 'user2',
    priceGroup: { id: 'vip2', name: 'VIP 2' },
  },
  {
    id: '3',
    email: 'user3@example.com',
    username: 'user3',
    priceGroup: null,
  },
  {
    id: '4',
    email: 'sara@example.com',
    username: 'sara',
    priceGroup: { id: 'vip1', name: 'VIP 1' },
  },
  {
    id: '5',
    email: 'omar@example.com',
    username: 'omar',
    priceGroup: { id: 'vip3', name: 'VIP 3' },
  },
  {
    id: '6',
    email: 'layla@example.com',
    username: 'layla',
    priceGroup: { id: 'vip2', name: 'VIP 2' },
  },
];

// Mock Products Data
const MOCK_PRODUCTS = [
  { 
    id: '1', 
    name: 'PUBG UC', 
    isActive: true, 
    image: '/images/placeholder.png', 
    packages: [
      { 
        id: '1', 
        name: '60 UC', 
        isActive: true, 
        basePrice: 1.00, 
        capital: 1.00,
        type: 'fixed',
        prices: [
          { id: 'p1', groupId: 'vip1', groupName: 'VIP 1', price: 1.20 },
          { id: 'p2', groupId: 'vip2', groupName: 'VIP 2', price: 1.40 },
          { id: 'p3', groupId: 'vip3', groupName: 'VIP 3', price: 1.60 },
        ]
      },
      { 
        id: '2', 
        name: '325 UC', 
        isActive: true, 
        basePrice: 5.00, 
        capital: 5.00,
        type: 'fixed',
        prices: [
          { id: 'p4', groupId: 'vip1', groupName: 'VIP 1', price: 6.00 },
          { id: 'p5', groupId: 'vip2', groupName: 'VIP 2', price: 7.00 },
          { id: 'p6', groupId: 'vip3', groupName: 'VIP 3', price: 8.00 },
        ]
      },
    ] 
  },
  { 
    id: '2', 
    name: 'Free Fire', 
    isActive: true, 
    image: '/images/placeholder.png', 
    packages: [
      { 
        id: '3', 
        name: '100 Diamonds', 
        isActive: true, 
        basePrice: 2.00, 
        capital: 2.00,
        type: 'fixed',
        prices: [
          { id: 'p7', groupId: 'vip1', groupName: 'VIP 1', price: 2.40 },
          { id: 'p8', groupId: 'vip2', groupName: 'VIP 2', price: 2.80 },
          { id: 'p9', groupId: 'vip3', groupName: 'VIP 3', price: 3.20 },
        ]
      },
      { 
        id: '4', 
        name: '500 Diamonds', 
        isActive: true, 
        basePrice: 10.00, 
        capital: 10.00,
        type: 'fixed',
        prices: [
          { id: 'p10', groupId: 'vip1', groupName: 'VIP 1', price: 12.00 },
          { id: 'p11', groupId: 'vip2', groupName: 'VIP 2', price: 14.00 },
          { id: 'p12', groupId: 'vip3', groupName: 'VIP 3', price: 16.00 },
        ]
      },
    ] 
  },
  { 
    id: '3', 
    name: 'Fortnite V-Bucks', 
    isActive: true, 
    image: '/images/placeholder.png', 
    packages: [
      { 
        id: '5', 
        name: '1000 V-Bucks', 
        isActive: true, 
        basePrice: 8.00, 
        capital: 8.00,
        type: 'fixed',
        prices: [
          { id: 'p13', groupId: 'vip1', groupName: 'VIP 1', price: 9.60 },
          { id: 'p14', groupId: 'vip2', groupName: 'VIP 2', price: 11.20 },
          { id: 'p15', groupId: 'vip3', groupName: 'VIP 3', price: 12.80 },
        ]
      },
    ] 
  },
  { 
    id: '4', 
    name: 'Roblox', 
    isActive: false, 
    image: '/images/placeholder.png', 
    packages: [] 
  },
];

// Mock Orders Data
const MOCK_ORDERS = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    user: { id: '1', username: 'user1', email: 'user1@example.com' },
    product: { id: '1', name: 'PUBG UC' },
    package: { id: '1', name: '60 UC', price: 1.99 },
    status: 'completed',
    totalPrice: 1.99,
    currency: 'USD',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    user: { id: '2', username: 'user2', email: 'user2@example.com' },
    product: { id: '2', name: 'Free Fire' },
    package: { id: '2', name: '100 Diamonds', price: 2.50 },
    status: 'pending',
    totalPrice: 2.50,
    currency: 'EUR',
    createdAt: new Date().toISOString(),
  },
];

// Mock Payments Data
const MOCK_PAYMENTS = [
  { id: '1', name: 'PayPal', type: 'online', isActive: true },
  { id: '2', name: 'Stripe', type: 'online', isActive: true },
  { id: '3', name: 'Bank Transfer', type: 'manual', isActive: false },
];

// Mock Deposits Data
const MOCK_DEPOSITS = [
  {
    id: '1',
    user: { id: '1', username: 'user1' },
    amount: 100.00,
    method: { id: '1', name: 'PayPal' },
    status: 'approved',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    user: { id: '2', username: 'user2' },
    amount: 50.00,
    method: { id: '2', name: 'Stripe' },
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

// Mock Integrations Data
const MOCK_INTEGRATIONS = [
  {
    id: '1',
    name: 'Provider A',
    type: 'api',
    isActive: true,
    apiKey: 'mock-api-key-123',
    apiUrl: 'https://api.provider-a.com',
  },
  {
    id: '2',
    name: 'Provider B',
    type: 'webhook',
    isActive: false,
    webhookUrl: 'https://webhook.provider-b.com',
  },
];

// Mock Price Groups Data
const MOCK_PRICE_GROUPS = [
  { id: 'vip1', name: 'VIP 1' },
  { id: 'vip2', name: 'VIP 2' },
  { id: 'vip3', name: 'VIP 3' },
];

// Mock Currencies Data
const MOCK_CURRENCIES = [
  {
    id: '1',
    code: 'USD',
    name: 'الدولار الأمريكي',
    symbol: '$',
    rate: 1.00,
    exchangeRate: 1.00,
    isActive: true,
    isPrimary: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    code: 'TRY',
    name: 'الليرة التركية',
    symbol: '₺',
    rate: 32.50,
    exchangeRate: 32.50,
    isActive: true,
    isPrimary: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// Mock Tenants Data
const MOCK_TENANTS = [
  {
    id: '1',
    subdomain: 'tenant1',
    name: 'Tenant One',
    isActive: true,
    balance: 5000.00,
    currency: { id: '1', code: 'USD' },
  },
  {
    id: '2',
    subdomain: 'tenant2',
    name: 'Tenant Two',
    isActive: true,
    balance: 3500.00,
    currency: { id: '2', code: 'EUR' },
  },
];

// Mock Notifications Data
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    title: 'إشعار تجريبي',
    message: 'هذا إشعار تجريبي للاختبار',
    type: 'info',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

// Mock Stats/Reports Data
const MOCK_STATS = {
  totalUsers: MOCK_USERS.length,
  totalOrders: MOCK_ORDERS.length,
  totalRevenue: 4500.50,
  todayOrders: 15,
  pendingOrders: 3,
  completedOrders: 12,
};

// Mock API Response Helper
const mockResponse = <T = any>(data: T, delay = 300) => {
  return new Promise<{ data: T; status: number; statusText: string; headers: any; config: any }>((resolve) => {
    setTimeout(() => {
      resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any });
    }, delay);
  });
};

// Mock API Object
export const mockApi = {
  get: async <T = any>(url: string, config?: any) => {
    console.log('[MOCK API] GET:', url);

    // Users endpoints
    if (url.includes('/users') && !url.includes('/profile')) {
      // Users with price groups endpoint
      if (url.includes('/with-price-group')) {
        return mockResponse(MOCK_USERS_WITH_PRICE_GROUPS);
      }
      
      if (url.match(/\/users\/\d+$/)) {
        const id = url.split('/').pop();
        const user = MOCK_USERS.find(u => u.id === id);
        return mockResponse(user || MOCK_USERS[0]);
      }
      return mockResponse(MOCK_USERS);
    }

    // Profile endpoint
    if (url.includes('/profile')) {
      return mockResponse({
        id: 'current-user',
        email: 'admin@example.com',
        role: 'admin',
        balance: '1000.00',
        fullName: 'مدير النظام',
        phoneNumber: '+963123456789',
        currency: { id: '1', code: 'USD' },
      });
    }

    // Products endpoints
    if (url.includes('/products')) {
      // Price groups endpoint
      if (url.includes('/price-groups')) {
        return mockResponse(MOCK_PRICE_GROUPS);
      }
      
      // Package prices endpoint
      if (url.includes('/packages/prices')) {
        // Return all package prices
        const allPrices = MOCK_PRODUCTS.flatMap(prod => 
          prod.packages.map(pkg => ({
            packageId: pkg.id,
            prices: pkg.prices || []
          }))
        );
        return mockResponse(allPrices);
      }
      
      if (url.match(/\/products\/\d+$/)) {
        const id = url.split('/').pop();
        const product = MOCK_PRODUCTS.find(p => p.id === id);
        return mockResponse(product || MOCK_PRODUCTS[0]);
      }
      // Support for list format with items property
      if (url.includes('?') || url.includes('/global')) {
        return mockResponse({ items: MOCK_PRODUCTS });
      }
      return mockResponse(MOCK_PRODUCTS);
    }

    // Orders endpoints
    if (url.includes('/orders')) {
      if (url.match(/\/orders\/\d+$/)) {
        const id = url.split('/').pop();
        const order = MOCK_ORDERS.find(o => o.id === id);
        return mockResponse(order || MOCK_ORDERS[0]);
      }
      return mockResponse(MOCK_ORDERS);
    }

    // Currencies endpoints
    if (url.includes('/currencies')) {
      if (url.match(/\/currencies\/\d+$/)) {
        const id = url.split('/').pop();
        const currency = MOCK_CURRENCIES.find(c => c.id === id);
        return mockResponse(currency || MOCK_CURRENCIES[0]);
      }
      return mockResponse(MOCK_CURRENCIES);
    }

    // Payments endpoints
    if (url.includes('/payment')) {
      return mockResponse(MOCK_PAYMENTS);
    }

    // Deposits endpoints
    if (url.includes('/deposits')) {
      return mockResponse(MOCK_DEPOSITS);
    }

    // Integrations endpoints
    if (url.includes('/integrations')) {
      if (url.match(/\/integrations\/\d+$/)) {
        const id = url.split('/').pop();
        const integration = MOCK_INTEGRATIONS.find(i => i.id === id);
        return mockResponse(integration || MOCK_INTEGRATIONS[0]);
      }
      // Support for list format with items property
      if (url.includes('/integrations?') || url.includes('/admin/integrations')) {
        return mockResponse({ items: MOCK_INTEGRATIONS });
      }
      return mockResponse(MOCK_INTEGRATIONS);
    }

    // Tenants endpoints
    if (url.includes('/tenants') || url.includes('/billing')) {
      if (url.match(/\/(tenants|billing)\/\d+$/)) {
        const id = url.split('/').pop();
        const tenant = MOCK_TENANTS.find(t => t.id === id);
        return mockResponse(tenant || MOCK_TENANTS[0]);
      }
      return mockResponse(MOCK_TENANTS);
    }

    // Notifications endpoints
    if (url.includes('/notifications')) {
      return mockResponse(MOCK_NOTIFICATIONS);
    }

    // Stats/Reports endpoints
    if (url.includes('/stats') || url.includes('/reports') || url.includes('/dashboard')) {
      return mockResponse(MOCK_STATS);
    }

    // Pages endpoints (banner, about, infoes)
    if (url.includes('/pages/banner')) {
      return mockResponse({
        id: '1',
        title: 'مرحباً بك في متجر وطن',
        description: 'أفضل متجر إلكتروني للألعاب والبطاقات الرقمية',
        imageUrl: '/images/banner.jpg',
        linkUrl: '/products',
        isActive: true,
      });
    }

    if (url.includes('/pages/about')) {
      return mockResponse({
        id: '1',
        title: 'عن المتجر',
        content: 'متجر وطن هو متجر إلكتروني متخصص في بيع البطاقات الرقمية والألعاب',
        isActive: true,
      });
    }

    if (url.includes('/pages/infoes')) {
      return mockResponse([
        { id: '1', title: 'سياسة الخصوصية', content: 'نحن نحترم خصوصيتك...', isActive: true },
        { id: '2', title: 'شروط الاستخدام', content: 'باستخدامك لهذا الموقع...', isActive: true },
      ]);
    }

    // Settings endpoints
    if (url.includes('/settings')) {
      return mockResponse({
        siteName: 'متجر وطن',
        siteDescription: 'متجر إلكتروني للألعاب',
        maintenanceMode: false,
        theme: 'dark1',
      });
    }

    // Dev notes endpoint
    if (url.includes('/dev/notes')) {
      return mockResponse({
        value: 'مرحباً بكم في النظام التجريبي',
        updatedAt: new Date().toISOString(),
      });
    }

    // Pending orders/deposits count
    if (url.includes('pending-orders-count')) {
      return mockResponse({ count: 3 });
    }

    if (url.includes('pending-deposits-count')) {
      return mockResponse({ count: 2 });
    }

    // Default response
    return mockResponse({ message: 'Mock data', data: [] });
  },

  post: async <T = any>(url: string, data?: any, config?: any) => {
    console.log('[MOCK API] POST:', url, data);
    
    // Simulate success for all POST requests
    if (url.includes('/topup')) {
      return mockResponse({ success: true, message: 'تمت إضافة الرصيد بنجاح' });
    }
    
    // Create currency
    if (url.includes('/currencies')) {
      const newCurrency = {
        id: String(MOCK_CURRENCIES.length + 1),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_CURRENCIES.push(newCurrency);
      return mockResponse(newCurrency);
    }
    
    return mockResponse({ success: true, message: 'تم الحفظ بنجاح', data });
  },

  put: async <T = any>(url: string, data?: any, config?: any) => {
    console.log('[MOCK API] PUT:', url, data);
    
    // Update currency
    if (url.includes('/currencies/')) {
      const id = url.split('/currencies/')[1]?.split('/')[0];
      const currencyIndex = MOCK_CURRENCIES.findIndex(c => c.id === id);
      
      if (currencyIndex !== -1) {
        MOCK_CURRENCIES[currencyIndex] = {
          ...MOCK_CURRENCIES[currencyIndex],
          ...data,
          updatedAt: new Date().toISOString(),
        };
        return mockResponse(MOCK_CURRENCIES[currencyIndex]);
      }
    }
    
    return mockResponse({ success: true, message: 'تم التحديث بنجاح', data });
  },

  delete: async <T = any>(url: string, config?: any) => {
    console.log('[MOCK API] DELETE:', url);
    
    // Delete currency
    if (url.includes('/currencies/')) {
      const id = url.split('/currencies/')[1]?.split('/')[0];
      const currencyIndex = MOCK_CURRENCIES.findIndex(c => c.id === id);
      
      if (currencyIndex !== -1) {
        MOCK_CURRENCIES.splice(currencyIndex, 1);
      }
      return mockResponse({ success: true, message: 'تم الحذف بنجاح' });
    }
    
    return mockResponse({ success: true, message: 'تم الحذف بنجاح' });
  },

  patch: async <T = any>(url: string, data?: any, config?: any) => {
    console.log('[MOCK API] PATCH:', url, data);
    
    // Update user price group
    if (url.includes('/users/') && url.includes('/price-group')) {
      const userId = url.split('/users/')[1]?.split('/')[0];
      const userIndex = MOCK_USERS_WITH_PRICE_GROUPS.findIndex(u => u.id === userId);
      
      if (userIndex !== -1) {
        const priceGroupId = data?.priceGroupId;
        const priceGroup = priceGroupId 
          ? MOCK_PRICE_GROUPS.find(g => g.id === priceGroupId) || null
          : null;
        
        MOCK_USERS_WITH_PRICE_GROUPS[userIndex] = {
          ...MOCK_USERS_WITH_PRICE_GROUPS[userIndex],
          priceGroup: priceGroup ? { id: priceGroup.id, name: priceGroup.name } : null,
        };
      }
      
      return mockResponse({ success: true, message: 'تم تحديث مجموعة السعر بنجاح' });
    }
    
    return mockResponse({ success: true, message: 'تم التحديث بنجاح', data });
  },
};
