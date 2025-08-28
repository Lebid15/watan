import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminBillingTenants from '@/app/admin/billing/page';

jest.mock('@/utils/billingApi', ()=>({ adminListTenants: jest.fn(()=>Promise.resolve({ data: { items: [ { tenantId:'t1', tenantName:'Shop', status:'ACTIVE', openInvoices:1, overdueOpenInvoices:0, lastInvoiceAmountUSD3:'10.000' } ], total:1 } })) }));
Object.defineProperty(window,'localStorage',{ value: { getItem:()=> 'TOKEN' } });

describe('AdminBillingTenants', ()=>{
  it('shows tenant row', async ()=>{
    render(<AdminBillingTenants />);
    expect(await screen.findByText(/Shop/)).toBeInTheDocument();
  });
});
