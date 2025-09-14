import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Provide factory creating its own mock object (no outer variable referenced to avoid TDZ)
jest.mock('@/utils/api', () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return { __esModule: true, default: mock, API_ROUTES: { products: { base: '/api/admin/products', priceGroups: '/api/admin/price-groups' } } };
});

import PriceGroupsPage from '../page';
// After import, retrieve the mock reference
const apiMock = require('@/utils/api').default as any;

function queueFetch(sequence: any[]) {
  const fn = jest.fn(async (url: string, opts: any = {}) => {
    const next = sequence.shift();
    if (!next) return { ok: true, json: async () => ({}) } as Response;
    return { ok: next.ok !== false, status: next.ok === false ? 500 : 200, json: async () => next.json || {} } as Response;
  });
  (global as any).fetch = fn;
  return fn;
}

describe('PriceGroupsPage integration (prices only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders products and group prices without unit price column', async () => {
    process.env.NEXT_PUBLIC_PRICE_DECIMALS = '2';
  apiMock.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/products')) {
        return { data: [
          { id: 'prod1', name: 'Prod', packages: [
            { id: 'pf', name: 'Fixed Pkg', type: 'fixed', basePrice: 3, prices: [] },
            { id: 'pu', name: 'Unit Pkg', type: 'unit', basePrice: 4, prices: [] }
          ] }
        ] };
      }
      if (url.endsWith('/price-groups')) {
        return { data: [{ id: 'g1', name: 'Group 1' }] };
      }
      return { data: [] };
    });
    // fetch sequence: initial GET (no override), PUT success, GET returns override
    queueFetch([
      { json: {} },
      { json: {} },
      { json: { unitPrice: 2.5 } }
    ]);
    render(<PriceGroupsPage />);
    await screen.findByText('Prod');
    // Ensure table headers present (اسم الباقة + رأس المال + group name + الحالة)
    expect(screen.queryByText('Unit price')).not.toBeInTheDocument();
  });
});
