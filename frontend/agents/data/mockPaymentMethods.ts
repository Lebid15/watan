// بيانات طرق الدفع الوهمية

export type PaymentMethodType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'HAND_DELIVERY' | 'USDT' | 'MONEY_TRANSFER';

export interface MockPaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  logoUrl?: string;
  note?: string;
  isActive: boolean;
}

export const MOCK_PAYMENT_METHODS: MockPaymentMethod[] = [
  {
    id: 'visa',
    name: 'بطاقة ائتمان',
    type: 'BANK_ACCOUNT',
    logoUrl: '💳',
    note: 'Visa / Mastercard',
    isActive: true
  },
  {
    id: 'bank-transfer',
    name: 'تحويل بنكي',
    type: 'BANK_ACCOUNT',
    logoUrl: '🏦',
    note: 'تحويل مباشر',
    isActive: true
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'MONEY_TRANSFER',
    logoUrl: '🅿️',
    note: 'محفظة PayPal',
    isActive: true
  },
  {
    id: 'usdt',
    name: 'USDT',
    type: 'USDT',
    logoUrl: '₮',
    note: 'Tether (TRC20/ERC20)',
    isActive: true
  },
  {
    id: 'cash',
    name: 'كاش',
    type: 'CASH_BOX',
    logoUrl: '💵',
    note: 'تسليم يدوي',
    isActive: true
  },
  {
    id: 'ewallet',
    name: 'محفظة إلكترونية',
    type: 'MONEY_TRANSFER',
    logoUrl: '📱',
    note: 'محافظ رقمية',
    isActive: true
  }
];
