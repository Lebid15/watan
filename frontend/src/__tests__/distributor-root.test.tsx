import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DistributorLayout from '@/app/distributor/layout';

jest.mock('@/context/UserContext', ()=>({ useUser: ()=>({ user:{ id:'1', role:'distributor', balance:0, currency:'USD'}, loading:false, refreshUser:()=>Promise.resolve(), logout:()=>{} }) }));
jest.mock('next/navigation', ()=>({ useRouter: ()=>({ replace: jest.fn() }), usePathname: ()=>'/distributor' }));

describe('Distributor layout', ()=>{
  it('renders children when distributor', ()=>{
    const { getByText } = render(<DistributorLayout><div>Child</div></DistributorLayout>);
    expect(getByText('Child')).toBeInTheDocument();
  });
});
