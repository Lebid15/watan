import { fetchUnitPrice } from '../fetchUnitPrice';

describe('fetchUnitPrice', () => {
  test('returns direct unitPrice shape', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1',
      packageId: 'p1',
      baseUnitPrice: 7,
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ unitPrice: 9 }) })
    });
    expect(price).toBe(9);
  });

  test('returns from array shape', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p2', baseUnitPrice: 5,
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ data: [ { packageId: 'x', unitPrice: 1 }, { packageId: 'p2', unitPrice: 11 } ] }) })
    });
    expect(price).toBe(11);
  });

  test('falls back to base on error', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p3', baseUnitPrice: 4,
      fetchImpl: () => Promise.reject(new Error('network'))
    });
    expect(price).toBe(4);
  });

  test('returns base when groupId null', async () => {
    const price = await fetchUnitPrice({ groupId: null, packageId: 'p4', baseUnitPrice: 6 });
    expect(price).toBe(6);
  });

  test('returns null if no base and nothing found', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p5', baseUnitPrice: null,
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ data: [] }) })
    });
    expect(price).toBeNull();
  });
});
