// src/utils/format.ts
import { useEffect, useState } from 'react';

// ✅ تبقى كما هي
export const formatGroupsDots = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    .format(n)
    .replace(/,/g, '.');

// ✅ جلب رمز العملة من الكود
export function currencySymbol(code?: string) {
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    case 'EGP': return '£';
    case 'SAR': return '﷼';
    case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س';
    default: return code || ''; // في حال لم تُعرف العملة
  }
}

// ✅ تنسيق مبلغ مع أو بدون رمز العملة
export function formatMoney(
  amount: number | string,
  code?: string,
  options?: { fractionDigits?: number; withSymbol?: boolean; symbolBefore?: boolean }
) {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const fractionDigits = options?.fractionDigits ?? 2;
  const withSymbol = options?.withSymbol ?? true;
  const symbolBefore = options?.symbolBefore ?? false;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(isNaN(value) ? 0 : value);

  if (!withSymbol) return formatted;

  const sym = currencySymbol(code);
  return symbolBefore && sym
    ? `${sym} ${formatted}`
    : `${formatted} ${sym}`.trim();
}

// ✅ 3-decimal fixed formatting (مستخدمة بالتقارير / الفواتير / الطلبات)
export function formatMoney3(amount: number | string) {
  const v = typeof amount === 'string' ? Number(amount) : amount;
  return (isNaN(v) ? 0 : v).toFixed(3);
}

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

// ✅ Default export لتسهيل الاستيراد
const formatUtils = {
  formatGroupsDots,
  currencySymbol,
  formatMoney,
  formatMoney3,
  useDebounce,
};
export default formatUtils;
