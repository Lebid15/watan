// Dynamic pricing formatting utilities aligned with backend PRICE_DECIMALS
// Assumes backend exposes desired precision via env (NEXT_PUBLIC_PRICE_DECIMALS) or defaults to 2.

export const PRICE_DECIMALS: number = (() => {
  const raw = process.env.NEXT_PUBLIC_PRICE_DECIMALS || '2';
  const n = parseInt(raw, 10);
  return n === 3 ? 3 : 2; // constrain to 2 or 3 only
})();

const pow10 = (p: number) => (p <= 0 ? 1 : 10 ** p);

export function clampDecimals(value: string | number): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(s)) return '';
  if (PRICE_DECIMALS === 0) return String(parseInt(s, 10));
  const [intPart, fracRaw = ''] = s.split('.');
  const frac = fracRaw.slice(0, PRICE_DECIMALS).replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart;
}

export function formatPrice(value: string | number | null | undefined, opts: { fixed?: boolean } = {}): string {
  if (value == null || value === '') return '0';
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (opts.fixed) return n.toFixed(PRICE_DECIMALS);
  const s = n.toFixed(PRICE_DECIMALS);
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

export function inputStep(): number {
  return 1 / pow10(PRICE_DECIMALS);
}

export function parseDecimalInput(s: string): number | null {
  if (!/^\d*(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const fixed = Number(n.toFixed(PRICE_DECIMALS));
  return fixed;
}
