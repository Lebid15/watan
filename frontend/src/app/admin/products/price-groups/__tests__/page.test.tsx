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

describe('PriceGroupsPage integration (Unit price column)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows Unit price column only for unit packages and supports edit flow', async () => {
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
    // Unit price column header
    expect(screen.getByText('Unit price')).toBeInTheDocument();
    // Fixed package row should show dash
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  // Start edit for unit package (button shows dash initially)
  const unitBtn = await screen.findByRole('button', { name: 'تعديل سعر الوحدة' });
    fireEvent.click(unitBtn);
    const input = await screen.findByLabelText('قيمة سعر الوحدة');
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
  await waitFor(() => expect(screen.getByText('معدل')).toBeInTheDocument());
    expect(screen.getByText('2.5')).toBeInTheDocument();
  });

  test('digits=3 sets step=0.001', async () => {
    process.env.NEXT_PUBLIC_PRICE_DECIMALS = '3';
  apiMock.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/products')) {
        return { data: [ { id: 'prod1', name: 'Prod', packages: [ { id: 'pu', name: 'Unit Pkg', type: 'unit', basePrice: 4, prices: [] } ] } ] };
      }
      if (url.endsWith('/price-groups')) return { data: [{ id: 'g1', name: 'Group 1' }] };
      return { data: [] };
    });
    queueFetch([{ json: {} }]);
    render(<PriceGroupsPage />);
    await screen.findByText('Prod');
  const unitBtn = await screen.findByRole('button', { name: 'تعديل سعر الوحدة' });
    fireEvent.click(unitBtn);
    const input = await screen.findByLabelText('قيمة سعر الوحدة');
    expect(input).toHaveAttribute('step', '0.001');
  });

  test('PUT failure rolls back optimistic value', async () => {
    process.env.NEXT_PUBLIC_PRICE_DECIMALS = '2';
  apiMock.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/products')) {
  return { data: [ { id: 'prod1', name: 'Prod', packages: [ { id: 'pu', name: 'Unit Pkg', type: 'unit', basePrice: 4, prices: [] } ] } ] };
      }
      if (url.endsWith('/price-groups')) return { data: [{ id: 'g1', name: 'Group 1' }] };
      return { data: [] };
    });
    // initial GET no override, PUT fails, GET still no override
    queueFetch([
      { json: {} },
      { ok: false, json: { message: 'خطأ' } },
      { json: {} }
    ]);
    render(<PriceGroupsPage />);
    await screen.findByText('Prod');
  const unitBtn = await screen.findByRole('button', { name: 'تعديل سعر الوحدة' });
    fireEvent.click(unitBtn);
    const input = await screen.findByLabelText('قيمة سعر الوحدة');
    fireEvent.change(input, { target: { value: '3.33' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    // Wait a moment for failure handling
  await waitFor(() => expect(screen.queryByText('معدل')).not.toBeInTheDocument());
    // Should still allow re-edit: base button present again
  });
});
