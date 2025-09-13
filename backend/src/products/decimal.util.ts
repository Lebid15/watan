import { getPriceDecimals, getScaleNumber, getDecimalRegex } from '../config/pricing.config';

export const toInt = (v: string | number): number => {
  const scale = getScaleNumber();
  const num = typeof v === 'number' ? v : parseFloat(String(v));
  return Math.round(num * scale);
};

export const toDec = (n: number): string => {
  const scale = getScaleNumber();
  const d = getPriceDecimals();
  return (n / scale).toFixed(d);
};

export const isValidDec = (s: string | number): boolean => {
  if (s === null || s === undefined) return false;
  return getDecimalRegex().test(String(s).trim());
};

export { getPriceDecimals as PRICE_DECIMALS };
