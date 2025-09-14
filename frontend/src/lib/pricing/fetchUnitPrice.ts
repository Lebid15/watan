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

  // We now prefer the bulk packages/prices endpoint. Some environments might still expect singular 'packageId'
  // so we will attempt BOTH query param variants to avoid silent mismatch.
  const bulkPlural = `/api/products/packages/prices?packageIds=${encodeURIComponent(packageId)}&groupId=${encodeURIComponent(groupId)}`;
  const bulkSingular = `/api/products/packages/prices?packageId=${encodeURIComponent(packageId)}&groupId=${encodeURIComponent(groupId)}`;
  // Legacy single endpoint
  const legacyEp = `/api/products/price-groups/${groupId}/package-prices?packageId=${encodeURIComponent(packageId)}`;
  // Allow explicit override (if provided by caller) – will be tried first
  const candidates: string[] = [];
  if (endpoint) candidates.push(endpoint);
  candidates.push(bulkPlural, bulkSingular, legacyEp);

  for (const ep of candidates) {
    try {
      const res = await f(ep);
      if (!res.ok) continue;
      let json: any = null;
      try { json = await res.json(); } catch { continue; }

      // Case 1: direct object with unitPrice
      if (json && !Array.isArray(json) && (typeof json.unitPrice === 'number' || (typeof json.unitPrice === 'string' && json.unitPrice.trim() !== ''))) {
        const n = Number(json.unitPrice);
        if (Number.isFinite(n)) return n;
      }

      // Case 2: array root (e.g. packages/prices returns an array of rows)
      if (Array.isArray(json)) {
        const row = json.find((r: any) => String(r?.packageId) === packageId);
        if (row) {
          // Prefer explicit unitPrice
            if (row.unitPrice != null && (typeof row.unitPrice === 'number' || (typeof row.unitPrice === 'string' && row.unitPrice.trim() !== ''))) {
              const n = Number(row.unitPrice);
              if (Number.isFinite(n)) return n;
            }
            // Fallback: some older rows may only expose 'price' (override) for unit packages
            if (row.price != null && (typeof row.price === 'number' || (typeof row.price === 'string' && row.price.trim() !== ''))) {
              const np = Number(row.price);
              if (Number.isFinite(np)) return np;
            }
        }
      }

      // Case 3: object with data array
      if (json && Array.isArray(json.data)) {
        const item = json.data.find((x: any) => String(x?.packageId) === packageId);
        if (item && (typeof item.unitPrice === 'number' || (typeof item.unitPrice === 'string' && item.unitPrice.trim() !== ''))) {
          const n = Number(item.unitPrice);
          if (Number.isFinite(n)) return n;
        }
      }
    } catch {
      // try next candidate
      continue;
    }
  }

  // If nothing found return the provided base (may be null)
  return baseUnitPrice ?? null;
}

export default fetchUnitPrice;
