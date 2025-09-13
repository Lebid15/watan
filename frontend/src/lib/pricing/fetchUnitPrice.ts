/**
 * fetchUnitPrice
 * Attempts to retrieve an effective unit price override for a given package & price group.
 * Supports multiple response shapes for forward compatibility:
 *  1. { unitPrice: number }
 *  2. { data: [ { packageId, unitPrice }, ... ] }
 *  3. Any other / error -> returns base fallback.
 *
 * The function NEVER throws; it resolves to a number | null (null meaning no better override found).
 */
export interface FetchUnitPriceOptions {
  groupId: string | null | undefined;
  packageId: string;
  endpoint?: string; // Allows overriding the base endpoint path for future changes
  baseUnitPrice: number | null | undefined;
  fetchImpl?: typeof fetch; // for testing injection
}

export async function fetchUnitPrice(options: FetchUnitPriceOptions): Promise<number | null> {
  const { groupId, packageId, baseUnitPrice, endpoint, fetchImpl } = options;
  if (!groupId) return baseUnitPrice ?? null;
  const f = fetchImpl || fetch;
  const ep = endpoint || `/api/products/price-groups/${groupId}/package-prices?packageId=${encodeURIComponent(packageId)}`;
  try {
    const res = await f(ep);
    if (!res.ok) return baseUnitPrice ?? null;
    let json: any = null;
    try { json = await res.json(); } catch { return baseUnitPrice ?? null; }
    if (json && typeof json.unitPrice === 'number') return json.unitPrice;
    if (json && Array.isArray(json.data)) {
      const item = json.data.find((x: any) => String(x?.packageId) === packageId);
      if (item && typeof item.unitPrice === 'number') return item.unitPrice;
    }
    return baseUnitPrice ?? null;
  } catch {
    return baseUnitPrice ?? null;
  }
}

export default fetchUnitPrice;
