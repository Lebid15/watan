import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BillingOverviewPage from '@/app/billing/overview/page';

jest.mock('@/utils/billingApi', ()=>({ getTenantBillingOverview: jest.fn(()=>Promise.resolve({ data: { status:'ACTIVE', currentPeriodStart:'2025-01-01', currentPeriodEnd:'2025-01-31', nextDueAt:'2025-02-03', openInvoiceCount:1, lastInvoice:{ amountUsd:'12.345'} } })) }));
Object.defineProperty(window,'localStorage',{ value: { getItem:()=> 'TOKEN' } });

describe('BillingOverviewPage', ()=>{
  it('renders fields', async ()=>{
    render(<BillingOverviewPage />);
    expect(await screen.findByText(/12.345/)).toBeInTheDocument();
  });
});
