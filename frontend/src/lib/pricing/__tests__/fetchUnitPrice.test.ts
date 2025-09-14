import { fetchUnitPrice } from '../fetchUnitPrice';

describe('fetchUnitPrice (no fallback model)', () => {
  test('returns direct price shape (price)', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1',
      packageId: 'p1',
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ price: 9 }) })
    });
    expect(price).toBe(9);
  });

  test('returns from array root shape', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p2',
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve([ { packageId: 'x', price: 1 }, { packageId: 'p2', price: 11 } ]) })
    });
    expect(price).toBe(11);
  });

  test('returns from object.data[] shape', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p3',
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ data: [ { packageId: 'p3', price: 4.75 } ] }) })
    });
    expect(price).toBe(4.75);
  });

  test('returns null on network error (no fallback)', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p4',
      fetchImpl: () => Promise.reject(new Error('network'))
    });
    expect(price).toBeNull();
  });

  test('returns null when groupId is null', async () => {
    const price = await fetchUnitPrice({ groupId: null, packageId: 'p5' });
    expect(price).toBeNull();
  });

  test('returns null if nothing found', async () => {
    const price = await fetchUnitPrice({
      groupId: 'g1', packageId: 'p6',
      fetchImpl: () => Promise.resolve<any>({ ok: true, json: () => Promise.resolve({ data: [] }) })
    });
    expect(price).toBeNull();
  });
});
