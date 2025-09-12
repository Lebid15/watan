'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import api, { API_ROUTES } from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  // Legacy fixed design support: if env NEXT_PUBLIC_LEGACY_ADMIN_FIXED_WIDTH=1 we keep old 1280px behaviour.
  const LEGACY = process.env.NEXT_PUBLIC_LEGACY_ADMIN_FIXED_WIDTH === '1';
  const DESIGN_WIDTH = 1280; // kept only for legacy mode or max-width reference.
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const isMobileFrame = search.get('mobile') === '1';
  // رسالة التنبيه العامة (يتم ضبطها من صفحة المطور). نتركها فارغة إن لم تُحدد.
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get(API_ROUTES.users.profileWithCurrency).catch((e: any) => e?.response);
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

  // دالة إعادة تحميل الملاحظة من localStorage
  const loadAlert = () => {
    try {
      const note = localStorage.getItem('adminGlobalAlert');
      if (note && note.trim()) {
        setAlertMessage(note.trim());
      } else {
        setAlertMessage('');
      }
    } catch {
      setAlertMessage('');
    }
  };

  // تحميل أولي + تحديث عند تركيز النافذة أو تغيير الرؤية أو استقبال حدث مخصص
  useEffect(() => {
    loadAlert();
    const onCustom = () => loadAlert();
    const onFocus = () => loadAlert();
    const onVis = () => { if (document.visibilityState === 'visible') loadAlert(); };
    window.addEventListener('adminGlobalAlertUpdated', onCustom as any);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('adminGlobalAlertUpdated', onCustom as any);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('userPriceGroupId'); localStorage.removeItem('token'); } catch {}
    router.replace('/login');
  };

  if (!authReady) return null;

  // Responsive container: fluid width with a comfortable max, allow content to wrap and avoid horizontal pinch.
  // We wrap main vertical layout in flex column so inner scroll areas can use min-h-0 if needed later.
  const inner = (
    <div
      className={
        'flex flex-col min-h-screen mx-auto ' +
        (LEGACY
          ? ''
          : 'w-full max-w-[1280px] px-4 md:px-6')
      }
      style={LEGACY ? { width: DESIGN_WIDTH, minWidth: DESIGN_WIDTH, minHeight: '100vh', overflowX: 'auto' } : undefined}
    >
      <div className="bg-[var(--toppage)] text-gray-100 w-full">
        <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
      </div>
      <AdminNavbar />
      <div className={LEGACY ? 'p-' : 'py-4'}>
        {children}
      </div>
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
