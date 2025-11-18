// بيانات الإيداعات الوهمية

export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface MockDeposit {
  id: string;
  method: { name: string; logoUrl?: string };
  originalAmount: number;
  originalCurrency: string;
  walletCurrency: string;
  rateUsed: number;
  convertedAmount: number;
  note?: string;
  status: DepositStatus;
  createdAt: string;
  source: 'user_request' | 'admin_topup';
  approvedAt?: string;
}

export const MOCK_DEPOSITS: MockDeposit[] = [
  {
    id: 'dep-001',
    method: { name: 'بطاقة ائتمان' },
    originalAmount: 100,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 100,
    status: 'pending',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // قبل 30 دقيقة
    source: 'user_request',
    note: 'قيد المراجعة من قبل الإدارة'
  },
  {
    id: 'dep-002',
    method: { name: 'تحويل بنكي' },
    originalAmount: 500,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 500,
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // قبل يومين
    approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    source: 'user_request',
    note: 'تم الشحن بنجاح'
  },
  {
    id: 'dep-003',
    method: { name: 'شحن إداري' },
    originalAmount: 250,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 250,
    status: 'approved',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // قبل 5 أيام
    approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'admin_topup',
    note: 'مكافأة من الإدارة'
  },
  {
    id: 'dep-004',
    method: { name: 'PayPal' },
    originalAmount: 50,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 50,
    status: 'rejected',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // قبل أسبوع
    source: 'user_request',
    note: 'فشل في التحقق من الدفع'
  },
  {
    id: 'dep-005',
    method: { name: 'بطاقة ائتمان' },
    originalAmount: 200,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 200,
    status: 'approved',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // قبل 10 أيام
    approvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    source: 'user_request',
    note: 'تم الإيداع بنجاح'
  },
  {
    id: 'dep-006',
    method: { name: 'محفظة إلكترونية' },
    originalAmount: 150,
    originalCurrency: 'USD',
    walletCurrency: 'USD',
    rateUsed: 1,
    convertedAmount: 150,
    status: 'approved',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // قبل 15 يوم
    approvedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    source: 'user_request',
    note: 'معالجة سريعة'
  }
];
