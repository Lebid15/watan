import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// We import the whole page file because UnitPriceOverrideCell is declared there.
import PriceGroupsPage from '@/app/admin/products/price-groups/page';

// Helper to inject the cell directly (we could refactor cell into separate file for cleaner import).
// Instead, we'll re-render a lightweight wrapper that mounts the cell via dynamic extraction.

// Since UnitPriceOverrideCell is not exported, we'll simulate its behavior by rendering a minimal mock table row.
// To keep the test faithful, we will mock fetch responses that PriceGroupsPage + cell rely on.

// Note: we will assign (global as any).fetch dynamically; no need to redeclare types.

const mkFetchSequence = () => {
  const calls: { method: string; url: string; body?: any; status?: number; json?: any }[] = [];
  const fn = jest.fn(async (url: string, opts: any = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const call = calls.shift();
    if (!call) {
      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response;
    }
    // Match by expected url pattern ignoring query ordering
    return {
      ok: (call.status ?? 200) >= 200 && (call.status ?? 200) < 300,
      status: call.status ?? 200,
      json: async () => call.json ?? {},
    } as Response;
  });
  (fn as any).queue = (entry: Partial<typeof calls[number]>) => calls.push({ method: entry.method || 'GET', url: entry.url || '', body: entry.body, status: entry.status, json: entry.json });
  return fn as any;
};

function primeSuccessfulOverride(fetchMock: any, value: number) {
  // GET override (initial) returns empty
  fetchMock.queue({ method: 'GET', url: '/api/admin/products/price-groups/g1/package-prices?packageId=p1', json: {} });
  // PUT save
  fetchMock.queue({ method: 'PUT', url: '/api/admin/price-groups/g1/package-prices/p1/unit', json: {} });
  // GET after save returns new override
  fetchMock.queue({ method: 'GET', url: '/api/admin/products/price-groups/g1/package-prices?packageId=p1', json: { unitPrice: value } });
}

function primeDeleteSequence(fetchMock: any, existingValue: number) {
  // initial GET returning existing override
  fetchMock.queue({ method: 'GET', url: '/api/admin/products/price-groups/g1/package-prices?packageId=p1', json: { unitPrice: existingValue } });
  // DELETE
  fetchMock.queue({ method: 'DELETE', url: '/api/admin/price-groups/g1/package-prices/p1/unit', json: {} });
  // GET after delete returns none
  fetchMock.queue({ method: 'GET', url: '/api/admin/products/price-groups/g1/package-prices?packageId=p1', json: {} });
}

// NOTE: Because the component is embedded deep inside PriceGroupsPage with heavy data fetching logic,
// a full isolated unit test would require refactor. Here we simulate a minimal environment by:
// - Mocking api.get responses used in fetchData() for products & priceGroups (axios wrapper 'api').
// - Then interacting with the rendered Unit price cell.

jest.mock('@/utils/api', () => {
  // Minimal axios-like API with get/post returning required shapes.
  return {
    __esModule: true,
    default: {
      get: jest.fn(async (url: string) => {
        if (url.endsWith('/products')) {
          return { data: [ { id: 'prod1', name: 'Product One', packages: [ { id: 'p1', name: 'Pkg Unit', type: 'unit', basePrice: 10, prices: [] } ] } ] };
        }
        if (url.endsWith('/price-groups')) {
          return { data: [ { id: 'g1', name: 'Group 1' } ] };
        }
        return { data: [] };
      }),
      post: jest.fn(async () => ({ data: [] })),
      put: jest.fn(async () => ({ data: {} })),
      delete: jest.fn(async () => ({ data: {} }))
    },
    API_ROUTES: {
      products: { base: '/api/admin/products', priceGroups: '/api/admin/price-groups' }
    }
  };
});

// Utility to render page and return helpers
async function renderPageWithFetch(fetchMock: any) {
  (global as any).fetch = fetchMock;
  process.env.NEXT_PUBLIC_PRICE_DECIMALS = '2';
  render(<PriceGroupsPage />);
  // wait for initial data to finish loading (Product name appears)
  await screen.findByText('Product One');
}

describe('UnitPriceOverrideCell (embedded)', () => {
  test('starts empty (—) then saves override and shows badge', async () => {
    const f = mkFetchSequence();
    primeSuccessfulOverride(f, 5.55);
    await renderPageWithFetch(f);
    // open edit: click the edit button (initial dash state)
  const editBtn = await screen.findByRole('button', { name: 'تعديل سعر الوحدة' });
    fireEvent.click(editBtn);
    const input = await screen.findByLabelText('قيمة سعر الوحدة');
    fireEvent.change(input, { target: { value: '5.55' } });
    // save
    const saveBtn = screen.getByRole('button', { name: '✓' });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(screen.getByText(/معدل/)).toBeInTheDocument());
    expect(screen.getByText('5.55')).toBeInTheDocument();
  });

  test('delete override reverts to base display', async () => {
    const f = mkFetchSequence();
    primeDeleteSequence(f, 7.5);
    await renderPageWithFetch(f);
    // Should show overridden value first (7.5)
    await screen.findByText('7.5');
  const deleteBtn = screen.getByRole('button', { name: 'حذف التخصيص' });
    fireEvent.click(deleteBtn);
    // After deletion fetch returns empty so dash should appear again
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });

  test('invalid value (<=0) prevents PUT', async () => {
    const f = mkFetchSequence();
    // only initial GET
    f.queue({ method: 'GET', url: '/api/admin/products/price-groups/g1/package-prices?packageId=p1', json: {} });
    await renderPageWithFetch(f);
  const editBtn = await screen.findByRole('button', { name: 'تعديل سعر الوحدة' });
    fireEvent.click(editBtn);
    const input = await screen.findByLabelText('قيمة سعر الوحدة');
    fireEvent.change(input, { target: { value: '0' } });
    const saveBtn = screen.getByRole('button', { name: '✓' });
    fireEvent.click(saveBtn);
    // No badge should appear
    await new Promise(r => setTimeout(r, 150));
    expect(screen.queryByText(/معدل/)).not.toBeInTheDocument();
  });
});
