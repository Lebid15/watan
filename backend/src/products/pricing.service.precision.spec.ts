// Simple precision unit test (no DB) ensuring PRICE_DECIMALS behavior
process.env.TEST_DB_SQLITE = 'true';
process.env.TEST_DISABLE_SCHEDULERS = 'true';

import { setTestPriceDecimals } from '../../test/utils/price-decimals.helpers';
import { getPriceDecimals, getScaleBigInt, resetPriceDecimalsForTest } from '../config/pricing.config';

describe('pricing precision config', () => {
  it('PRICE_DECIMALS=2 formats integer scaled 1250 -> 12.50', () => {
    setTestPriceDecimals(2);
    resetPriceDecimalsForTest(); // ensure getters recompute
    const d2 = getPriceDecimals();
    const s2 = getScaleBigInt();
    expect(d2).toBe(2);
    expect(s2).toBe(BigInt(100)); // 10**2
    // Build a helper like scaledToString quickly
    const scaled = BigInt(1250);
    const intPart = scaled / s2;
    const frac = scaled % s2;
    const fracStr = frac.toString().padStart(d2, '0');
    const str = `${intPart.toString()}.${fracStr}`;
    expect(str).toBe('12.50');
  });

  it('PRICE_DECIMALS=3 formats 12.500', () => {
    setTestPriceDecimals(3);
    resetPriceDecimalsForTest();
    const d3 = getPriceDecimals();
    const s3 = getScaleBigInt();
    expect(d3).toBe(3);
    expect(s3).toBe(BigInt(1000));
    // 12.500 -> scaled = 12*1000 + 500
    const scaled = BigInt(12500);
    const intPart = scaled / s3;
    const frac = scaled % s3;
    const fracStr = frac.toString().padStart(d3, '0');
    const str = `${intPart.toString()}.${fracStr}`;
    expect(str).toBe('12.500');
  });
});