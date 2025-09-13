// Dynamic pricing formatting utilities for unit pricing & overrides
// Reads NEXT_PUBLIC_PRICE_DECIMALS (allowed: 2,3,4) with fallback to 2.

export function getDecimalDigits(): number {
  const raw = process.env.NEXT_PUBLIC_PRICE_DECIMALS;
  const n = raw ? Number(raw) : 2;
  return (n === 3 || n === 4) ? n : 2; // allow 2/3/4 (currently supporting 2 or 3 typical)
}

export function formatPrice(value: number|string|null|undefined, digits: number = getDecimalDigits()): string {
  if (value == null || value === '') return (0).toFixed(digits);
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  return n.toFixed(digits);
}

export function parsePriceInput(input: string, digits: number = getDecimalDigits()): number | null {
  if (!input) return null;
  const s = input.replace(',', '.').trim();
  if (!s || s === '.' || s === '-') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

export function priceInputStep(digits: number = getDecimalDigits()): number {
  if (digits <= 0) return 1;
  return Number('0.' + '0'.repeat(digits - 1) + '1');
}

export function clampPriceDecimals(n: number, digits: number = getDecimalDigits()): number {
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

export default {
  getDecimalDigits,
  formatPrice,
  parsePriceInput,
  priceInputStep,
  clampPriceDecimals,
};
