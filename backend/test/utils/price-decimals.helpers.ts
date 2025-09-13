// Test helper to set pricing decimals lazily
export function setTestPriceDecimals(decimals: 2|3|4) {
  process.env.PRICE_DECIMALS = String(decimals);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resetPriceDecimalsForTest } = require('../../src/config/pricing.config');
  resetPriceDecimalsForTest();
}
