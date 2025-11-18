// بيانات سجل المعاملات الوهمية

export type TransactionType = 'approved' | 'rejected' | 'status_change' | 'deposit' | 'deposit_reversal';

export interface MockTransaction {
  id: string;
  type: TransactionType;
  typeDisplay: string;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  createdAt: string;
  paymentMethod?: string;
}

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: 'tx-001',
    type: 'deposit',
    typeDisplay: 'شحن المحفظة',
    amount: 100,
    currency: 'USD',
    balanceBefore: 1150.50,
    balanceAfter: 1250.50,
    description: 'إيداع عبر بطاقة ائتمان',
    paymentMethod: 'بطاقة ائتمان',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // قبل ساعتين
  },
  {
    id: 'tx-002',
    type: 'approved',
    typeDisplay: 'قبول طلب',
    amount: -9.99,
    currency: 'USD',
    balanceBefore: 1250.50,
    balanceAfter: 1240.51,
    description: 'شراء PUBG 660 UC',
    orderId: 'order-001',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // قبل 3 ساعات
  },
  {
    id: 'tx-003',
    type: 'rejected',
    typeDisplay: 'رفض طلب',
    amount: 0,
    currency: 'USD',
    balanceBefore: 1240.51,
    balanceAfter: 1240.51,
    description: 'رفض طلب Steam - رصيد غير كافٍ',
    orderId: 'order-004',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // قبل يوم
  },
  {
    id: 'tx-004',
    type: 'deposit',
    typeDisplay: 'شحن المحفظة',
    amount: 500,
    currency: 'USD',
    balanceBefore: 740.51,
    balanceAfter: 1240.51,
    description: 'إيداع عبر تحويل بنكي',
    paymentMethod: 'تحويل بنكي',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // قبل 3 أيام
  },
  {
    id: 'tx-005',
    type: 'approved',
    typeDisplay: 'قبول طلب',
    amount: -25.00,
    currency: 'USD',
    balanceBefore: 765.51,
    balanceAfter: 740.51,
    description: 'شراء Netflix بطاقة 25$',
    orderId: 'order-003',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() // قبل 4 أيام
  },
  {
    id: 'tx-006',
    type: 'deposit',
    typeDisplay: 'شحن إداري',
    amount: 250,
    currency: 'USD',
    balanceBefore: 515.51,
    balanceAfter: 765.51,
    description: 'مكافأة من الإدارة',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // قبل 5 أيام
  },
  {
    id: 'tx-007',
    type: 'approved',
    typeDisplay: 'قبول طلب',
    amount: -4.99,
    currency: 'USD',
    balanceBefore: 520.50,
    balanceAfter: 515.51,
    description: 'شراء Free Fire 520 ماسة',
    orderId: 'order-002',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() // قبل 6 أيام
  },
  {
    id: 'tx-008',
    type: 'status_change',
    typeDisplay: 'تغيير حالة',
    amount: 0,
    currency: 'USD',
    balanceBefore: 520.50,
    balanceAfter: 520.50,
    description: 'تغيير حالة الطلب من قيد المراجعة إلى مقبول',
    orderId: 'order-005',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // قبل أسبوع
  },
  {
    id: 'tx-009',
    type: 'deposit',
    typeDisplay: 'شحن المحفظة',
    amount: 200,
    currency: 'USD',
    balanceBefore: 320.50,
    balanceAfter: 520.50,
    description: 'إيداع عبر PayPal',
    paymentMethod: 'PayPal',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // قبل 10 أيام
  },
  {
    id: 'tx-010',
    type: 'approved',
    typeDisplay: 'قبول طلب',
    amount: -49.98,
    currency: 'USD',
    balanceBefore: 370.48,
    balanceAfter: 320.50,
    description: 'شراء PUBG 1800 UC × 2',
    orderId: 'order-005',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() // قبل 12 يوم
  }
];
