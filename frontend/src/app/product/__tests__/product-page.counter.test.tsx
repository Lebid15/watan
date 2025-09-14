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

describe('ProductDetailsPage unit purchase (modal flow)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  function mockProduct(supportsCounter: boolean, unitCount = 1) {
    const unitPackages = supportsCounter
      ? Array.from({ length: unitCount }).map((_, i) => ({
          id: `unit${i+1}`,
          name: `Unit ${i+1}`,
          isActive: true,
          type: 'unit',
          unitName: 'وحدة',
          minUnits: 1,
          maxUnits: 5,
          step: 1,
          prices: [ { groupId: 'group1', unitPrice: 3 } ]
        }))
      : [];
    const fixedPkg = { id: 'fixed1', name: 'Fixed', isActive: true, basePrice: 10 };
    const product = { id: 'prod1', name: 'Prod', isActive: true, supportsCounter, packages: [fixedPkg, ...unitPackages] } as any;
    const api = require('@/utils/api').default;
    api.get.mockImplementation((url: string) => {
      if (url.includes('/user/prod1')) return Promise.resolve({ data: product });
      return Promise.reject(new Error('unexpected url ' + url));
    });
    api.post.mockResolvedValue({ data: { id: 'order999' } });
    return { product, api };
  }

  test('no unit badge when supportsCounter=false (no unit packages)', async () => {
    mockProduct(false);
    render(<ProductDetailsPage />);
    await screen.findByText('Prod');
    // badge has title 'الشراء بالعداد من الأسفل' when unit package present
    expect(screen.queryByTitle('الشراء بالعداد من الأسفل')).not.toBeInTheDocument();
  });

  test('unit badge visible when supportsCounter=true', async () => {
    mockProduct(true);
    render(<ProductDetailsPage />);
    await screen.findByText('Prod');
    await screen.findByTitle('الشراء بالعداد من الأسفل');
  });

  test('happy path unit order via modal', async () => {
    const { api } = mockProduct(true);
    render(<ProductDetailsPage />);
    await screen.findByText('Prod');
  const unitCard = await screen.findByTitle('Unit 1');
  fireEvent.click(unitCard); // opens modal
  await screen.findByText('الشراء بالعداد');
  // locate game id input: find label then closest input sibling
  const gameIdLabel = screen.getByText('معرف اللعبة');
  const gameIdInput = gameIdLabel.parentElement?.querySelector('input');
  expect(gameIdInput).toBeTruthy();
  fireEvent.change(gameIdInput as HTMLInputElement, { target: { value: 'player123' } });
    // fill quantity
    const qty = document.querySelector('input[inputmode="decimal"],input[inputmode="numeric"],input[type="number"]') as HTMLInputElement;
    expect(qty).toBeTruthy();
    fireEvent.change(qty, { target: { value: '2' } });
    // click purchase
    const buyBtn = screen.getByRole('button', { name: 'شراء' });
    expect(buyBtn).not.toBeDisabled();
    fireEvent.click(buyBtn);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const payload = api.post.mock.calls[0][1];
    expect(payload.quantity).toBe(2);
    expect(payload.packageId).toBe('unit1');
  });
});
