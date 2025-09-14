import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import TenantLayout from '@/app/tenant/layout';

// Mock user context
jest.mock('@/context/UserContext', ()=>({ useUser: ()=>({ user:{ id:'1', role:'tenant_owner', balance:0, currency:'USD'}, loading:false, refreshUser:()=>Promise.resolve(), refreshProfile:()=>Promise.resolve(), logout:()=>{} }) }));

jest.mock('next/navigation', ()=>({ useRouter: ()=>({ replace: jest.fn() }), usePathname: ()=>'/tenant' }));

describe('Tenant root layout', ()=>{
  it('renders children when tenant_owner', ()=>{
    const { getByText } = render(<TenantLayout><div>Child</div></TenantLayout>);
    expect(getByText('Child')).toBeInTheDocument();
  });
});
