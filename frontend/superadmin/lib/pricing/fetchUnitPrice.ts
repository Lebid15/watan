type FetchUnitPriceParams = {
  packageId: string;
  groupId?: string | null;
};

type UnitPriceResponse = {
  price?: number;
};

const ENDPOINT = '/api/pricing/unit-price';

export default async function fetchUnitPrice(params: FetchUnitPriceParams): Promise<number | null> {
  try {
    const url = new URL(ENDPOINT, typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin);
    url.searchParams.set('packageId', params.packageId);
    if (params.groupId) url.searchParams.set('groupId', params.groupId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn('fetchUnitPrice failed', res.status);
      return null;
    }

    const data = (await res.json()) as UnitPriceResponse;
    if (typeof data.price === 'number') return data.price;
  } catch (error) {
    console.error('fetchUnitPrice error', error);
  }
  return null;
}
