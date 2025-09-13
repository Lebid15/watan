// Central pricing precision configuration (no DB schema changes)
// Allow 2–4 decimals depending on environment (tests may set 3 or 4). Default remains 2.

// Central pricing precision configuration (lazy, no DB schema changes)
// Allow 2–4 decimals depending on environment (tests may set 3 or 4). Default remains 2.
let _priceDecimals: number | null = null;
let _decimalRegex: RegExp | null = null;

export function getPriceDecimals(): number {
  if (_priceDecimals == null) {
    _priceDecimals = Number(process.env.PRICE_DECIMALS ?? 2);
    // Clamp to supported range just in case
    if (_priceDecimals < 2) _priceDecimals = 2;
    if (_priceDecimals > 4) _priceDecimals = 4;
  }
  return _priceDecimals;
}

export function resetPriceDecimalsForTest(): void {
  _priceDecimals = null;
  _decimalRegex = null;
}

export function getScaleBigInt(): bigint {
  return BigInt(10) ** BigInt(getPriceDecimals());
}

export function getScaleNumber(): number {
  return 10 ** getPriceDecimals();
}

export function getDecimalRegex(): RegExp {
  if (_decimalRegex == null) {
    const d = getPriceDecimals();
    _decimalRegex = new RegExp(`^\\d+(?:\\.\\d{1,${d}})?$`);
  }
  return _decimalRegex;
}

export function isValidDecStr(s: string): boolean {
  if (s == null) return false;
  return getDecimalRegex().test(String(s).trim());
}

export function clampDecimals(value: string | number): string {
  const num = Number(value);
  const d = getPriceDecimals();
  if (!Number.isFinite(num)) return (0).toFixed(d);
  return num.toFixed(d);
}

