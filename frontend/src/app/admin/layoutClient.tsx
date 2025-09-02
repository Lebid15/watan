'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import api from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const isMobileFrame = search.get('mobile') === '1';
  const alertMessage = 'تنبيه: تم تحديث النظام، يرجى مراجعة صفحة الطلبات لمعرفة التفاصيل.';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get('/users/profile-with-currency').catch((e: any) => e?.response);
        if (!mounted) return;
        if (!r || r.status === 401) {
          const next = typeof window !== 'undefined' ? window.location.pathname : '/admin/dashboard';
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setAuthReady(true);
      } catch {
        if (!mounted) return;
        const next = typeof window !== 'undefined' ? window.location.pathname : '/admin/dashboard';
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('userPriceGroupId'); localStorage.removeItem('token'); } catch {}
    router.replace('/login');
  };

  if (!authReady) return null;

  const inner = (
    <div className="mx-auto" style={{ width: DESIGN_WIDTH, minWidth: DESIGN_WIDTH, minHeight: '100vh', overflowX: 'auto' }}>
      <div className="bg-[var(--toppage)] text-gray-100">
        <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
      </div>
      <AdminNavbar />
      <div className="p-">{children}</div>
    </div>
  );

  return (
    <div className="w-full min-h-screen overflow-auto">
      {isMobileFrame ? (
        <div className="p-4">
          <MobileZoomFrame width={390}>{inner}</MobileZoomFrame>
        </div>
      ) : inner}
    </div>
  );
}
