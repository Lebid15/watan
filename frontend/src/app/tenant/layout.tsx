"use client";
import React, { useEffect, useState } from 'react';
import ClientErrorBoundary from '@/components/ClientErrorBoundary';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';

// Simple role guard layout for tenant_owner area
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshProfile } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [ready,setReady] = useState(false);

  useEffect(()=>{ refreshProfile(); },[]); // ensure fresh user

  useEffect(()=>{
    try {
      // Log minimal diagnostics for tenant pages
      // Avoid leaking sensitive user data.
      console.info('[Diag][TenantLayout] mount', {
        react: (React as any)?.version || 'unknown',
        pathname,
        hasUser: !!user,
        loading,
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(()=>{
    if (loading) return;
    // Not logged in -> login redirect with next
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const role = (user.role||'').toLowerCase();
    // تطبيع الأدوار القديمة إلى tenant_owner مسبقاً (middleware) لكن نضيف حماية دفاعية هنا
    const normalized = ['instance_owner','owner','admin'].includes(role) ? 'tenant_owner' : role;
    if (normalized !== 'tenant_owner') {
      if (normalized === 'distributor') router.replace('/distributor');
      else router.replace('/403');
      return;
    }
    setReady(true);
  },[user, loading, router, pathname]);

  if (!ready) return null; // suppress flash
  return <ClientErrorBoundary>
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {children}
    </div>
  </ClientErrorBoundary>;
}
