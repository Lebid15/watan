import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CounterPurchaseCard, { CounterPackage, CounterProduct } from '../CounterPurchaseCard';

// Mock next/navigation router
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// Mock pricing format env digits (default 2 unless overridden per test)

const baseProduct: CounterProduct = { id: 'prod1', name: 'Test Product', supportsCounter: true };
const unitPkg: CounterPackage = {
  id: 'pkg1', name: 'Unit Package', isActive: true, type: 'unit',
  unitName: 'نقطة', minUnits: 1, maxUnits: 10, step: 0.5
};

function setup(fetchMockImpl?: any, overrides: Partial<CounterPackage> = {}, quantityPrefill?: string) {
  if (fetchMockImpl) {
    (global as any).fetch = jest.fn(fetchMockImpl);
  } else {
    (global as any).fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  }
  const pkg = { ...unitPkg, ...overrides };
  render(<CounterPurchaseCard product={baseProduct} packages={[pkg]} getUserPriceGroupId={() => 'group1'} />);
  const input = screen.getByLabelText('كمية الوحدات') as HTMLInputElement;
  if (quantityPrefill) {
    fireEvent.change(input, { target: { value: quantityPrefill } });
  }
  return { input };
}

describe('CounterPurchaseCard', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('updates live total when quantity changes (after price fetch)', async () => {
    setup(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ price: 2 }) }));
    const input = screen.getByLabelText('كمية الوحدات');
    // wait for price to load (unit price display should include 2.00 once quantity set)
    fireEvent.change(input, { target: { value: '3' } });
    await waitFor(() => {
      // Combined line may split nodes; use regex on container
      expect(screen.getByText(/السعر الفوري:/)).toBeInTheDocument();
      expect(screen.getByText(/2\.00/)).toBeInTheDocument();
    });
  });

  test('validation: rejects non numeric / zero / step mismatch', async () => {
    setup(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ unitPrice: 5 }) }));
    const input = screen.getByLabelText('كمية الوحدات');
    // zero
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    await screen.findByText('الكمية يجب أن تكون أكبر من صفر');
    // step mismatch (step=0.5 so 1.2 invalid)
    fireEvent.change(input, { target: { value: '1.2' } });
    fireEvent.blur(input);
    await screen.findByText('الكمية لا تطابق خطوة الزيادة');
  });

  test('success submission resets quantity', async () => {
    const orderResponse = { id: 'order123' };
    (global as any).fetch = jest.fn()
      // unit price fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ price: 5 }) })
      // order submit
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(orderResponse) });
    setup(undefined, {}, undefined);
    const input = screen.getByLabelText('كمية الوحدات') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    const button = screen.getByRole('button', { name: 'شراء' });
    fireEvent.click(button);
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(input.value).toBe(''));
  });

  test('failure submission keeps quantity', async () => {
    (global as any).fetch = jest.fn()
      // price fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ price: 5 }) })
      // order submit fails
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'ERR_LIMIT' }) });
    setup(undefined, {}, undefined);
    const input = screen.getByLabelText('كمية الوحدات') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    const button = screen.getByRole('button', { name: 'شراء' });
    fireEvent.click(button);
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));
    expect(input.value).toBe('2');
  });

  test('shows dash when no price resolved (failed fetch)', async () => {
    setup(() => Promise.resolve({ ok: false }));
    await waitFor(() => {
      expect(screen.getByText(/— × 0 =/)).toBeInTheDocument();
    });
  });
});
