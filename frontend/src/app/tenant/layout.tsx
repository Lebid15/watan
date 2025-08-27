"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import MainHeader from '@/components/layout/MainHeader';

// Simple role guard layout for tenant_owner area
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [ready,setReady] = useState(false);

  useEffect(()=>{ refreshUser(); },[]); // ensure fresh user

  useEffect(()=>{
    if (loading) return;
    // Not logged in -> login redirect with next
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const role = (user.role||'').toLowerCase();
    if (role !== 'tenant_owner') {
      // redirect to distributor / user dashboards if possible
      if (role === 'distributor') router.replace('/distributor');
      else if (role === 'instance_owner') router.replace('/owner');
      else router.replace('/403');
      return;
    }
    setReady(true);
  },[user, loading, router, pathname]);

  if (!ready) return null; // suppress flash
  return <div className="pt-20">
    <MainHeader />
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {children}
    </div>
  </div>;
}
