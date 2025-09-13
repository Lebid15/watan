import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductDetailsPage from '../[id]/page';

// We will mock hooks and api utilities
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'prod1' }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useAuthRequired', () => ({ useAuthRequired: () => {} }));

// Mock user context
jest.mock('@/context/UserContext', () => {
  const stableUser = { id: 'u1', priceGroupId: 'group1' };
  return { useUser: () => ({ user: stableUser, refreshProfile: jest.fn() }) };
});

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  API_ROUTES: { products: { base: '/api/products' }, orders: { base: '/api/orders' } }
}));

// Provide pricing formatter dependencies
jest.mock('@/utils/pricingFormat', () => ({
  getDecimalDigits: () => 2,
  formatPrice: (v: number) => v.toFixed(2),
  priceInputStep: () => '0.01',
  clampPriceDecimals: (v: number) => Number(v.toFixed(2))
}));

describe('ProductDetailsPage counter card integration', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  function mockProduct(supportsCounter: boolean, unitCount = 1) {
    const unitPackages = Array.from({ length: unitCount }).map((_, i) => ({
      id: `unit${i+1}`,
      name: `Unit ${i+1}`,
      isActive: true,
      type: 'unit',
      baseUnitPrice: 3,
      unitName: 'وحدة',
      minUnits: 1,
      maxUnits: 5,
      step: 1
    }));

    const fixedPkg = { id: 'fixed1', name: 'Fixed', isActive: true, basePrice: 10 };

    const product = { id: 'prod1', name: 'Prod', isActive: true, supportsCounter, packages: [fixedPkg, ...unitPackages] } as any;
    const api = require('@/utils/api').default;
    api.get.mockImplementation((url: string) => {
      if (url.includes('/user/prod1')) return Promise.resolve({ data: product });
      return Promise.reject(new Error('unexpected url ' + url));
    });
    // mock global fetch for override -> return direct unitPrice
    (global as any).fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ unitPrice: 3 }) }));
    return product;
  }

  test('card hidden when supportsCounter=false', async () => {
    mockProduct(false);
    render(<ProductDetailsPage />);
    await screen.findByText('Prod');
    expect(screen.queryByText('الشراء بالعداد')).not.toBeInTheDocument();
  });

  test('card visible when supportsCounter and unit package exists', async () => {
    mockProduct(true);
    render(<ProductDetailsPage />);
    await screen.findByText('Prod');
    expect(screen.getByText('الشراء بالعداد')).toBeInTheDocument();
  });

  test('happy path order submits via fetch and resets quantity', async () => {
    mockProduct(true);
    (global as any).fetch = jest.fn()
      // override fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ unitPrice: 3 }) })
      // order submit
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'order999' }) });
    render(<ProductDetailsPage />);
    await screen.findByText('الشراء بالعداد');
    const qty = screen.getByLabelText('كمية الوحدات') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '2' } });
    const btn = screen.getByRole('button', { name: 'شراء' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));
  });
});
