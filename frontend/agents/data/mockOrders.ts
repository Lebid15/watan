// بيانات الطلبات الوهمية

export type OrderStatus = 'pending' | 'approved' | 'rejected';

export interface MockOrder {
  id: string;
  orderNo: number;
  status: OrderStatus;
  createdAt: string;
  product: { name: string };
  package: { name: string };
  quantity: number;
  userIdentifier: string;
  extraField?: string;
  totalPrice: number;
  currencyCode: string;
  pinCode?: string;
  note?: string;
}

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: 'order-001',
    orderNo: 10245,
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // قبل ساعتين
    product: { name: 'PUBG Mobile' },
    package: { name: 'PUBG 660 UC' },
    quantity: 1,
    userIdentifier: '5123456789',
    totalPrice: 9.99,
    currencyCode: 'USD',
    pinCode: 'PUBG-1234-5678-9012',
    note: 'تم الشحن بنجاح'
  },
  {
    id: 'order-002',
    orderNo: 10246,
    status: 'pending',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // قبل 30 دقيقة
    product: { name: 'Free Fire' },
    package: { name: '520 ماسة' },
    quantity: 1,
    userIdentifier: '9876543210',
    extraField: 'Server: Asia',
    totalPrice: 4.99,
    currencyCode: 'USD'
  },
  {
    id: 'order-003',
    orderNo: 10247,
    status: 'approved',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // قبل 5 ساعات
    product: { name: 'Netflix' },
    package: { name: 'بطاقة 25$' },
    quantity: 1,
    userIdentifier: 'user@example.com',
    totalPrice: 25.00,
    currencyCode: 'USD',
    pinCode: 'NFLX-ABCD-EFGH-IJKL',
    note: 'البطاقة جاهزة للاستخدام'
  },
  {
    id: 'order-004',
    orderNo: 10248,
    status: 'rejected',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // قبل يوم
    product: { name: 'Steam' },
    package: { name: 'بطاقة 20$' },
    quantity: 1,
    userIdentifier: 'gamer123',
    totalPrice: 20.00,
    currencyCode: 'USD',
    note: 'رصيد غير كافي'
  },
  {
    id: 'order-005',
    orderNo: 10249,
    status: 'approved',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // قبل 3 أيام
    product: { name: 'PUBG Mobile' },
    package: { name: 'PUBG 1800 UC' },
    quantity: 2,
    userIdentifier: '1234567890',
    extraField: 'Region: Middle East',
    totalPrice: 49.98,
    currencyCode: 'USD',
    pinCode: 'PUBG-9876-5432-1098',
    note: 'تم التسليم'
  },
  {
    id: 'order-006',
    orderNo: 10250,
    status: 'pending',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // قبل 10 دقائق
    product: { name: 'Spotify' },
    package: { name: 'اشتراك شهري' },
    quantity: 1,
    userIdentifier: 'music.lover@email.com',
    totalPrice: 9.99,
    currencyCode: 'USD'
  },
  {
    id: 'order-007',
    orderNo: 10251,
    status: 'approved',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // قبل أسبوع
    product: { name: 'Mobile Legends' },
    package: { name: '500 ماسة' },
    quantity: 1,
    userIdentifier: '5551234567',
    totalPrice: 9.99,
    currencyCode: 'USD',
    pinCode: 'MLBB-1111-2222-3333',
    note: 'شحن فوري'
  },
  {
    id: 'order-008',
    orderNo: 10252,
    status: 'approved',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // قبل 12 ساعة
    product: { name: 'Google Play' },
    package: { name: 'بطاقة 10$' },
    quantity: 3,
    userIdentifier: 'android.user',
    totalPrice: 30.00,
    currencyCode: 'USD',
    pinCode: 'GPLY-XXXX-YYYY-ZZZZ',
    note: 'تم إرسال الأكواد'
  }
];

export function getMockOrderById(id: string): MockOrder | undefined {
  return MOCK_ORDERS.find(order => order.id === id);
}
