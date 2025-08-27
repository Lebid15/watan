import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import OwnerLayout from '@/app/owner/layout';

jest.mock('@/context/UserContext', ()=>({ useUser: ()=>({ user:{ id:'1', role:'instance_owner', balance:0, currency:'USD'}, loading:false, refreshUser:()=>Promise.resolve(), logout:()=>{} }) }));
jest.mock('next/navigation', ()=>({ useRouter: ()=>({ replace: jest.fn() }), usePathname: ()=>'/owner' }));

describe('Owner layout', ()=>{
  it('renders children for instance_owner', ()=>{
    const { getByText } = render(<OwnerLayout><div>Child</div></OwnerLayout>);
    expect(getByText('Child')).toBeInTheDocument();
  });
});
