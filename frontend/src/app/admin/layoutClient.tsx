'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import api, { API_ROUTES } from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  // الحد الأقصى لعرض منطقة الإدارة (تصميم ديسكتوب) مع واجهة مرنة mobile-first
  const DESIGN_WIDTH = 1280;
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

  const inner = (
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-[var(--toppage)] text-gray-100">
        <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
      </div>
      <AdminNavbar />
      <div className="flex-1 w-full mx-auto max-w-[1280px] px-3 sm:px-4 md:px-6 lg:px-8 py-4">
        {children}
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen overflow-auto">
      {isMobileFrame ? (
        <div className="p-4">
          {/* إطار الاختبار للموبايل (يحتفظ به) */}
          <MobileZoomFrame width={390}>{inner}</MobileZoomFrame>
        </div>
      ) : inner}
    </div>
  );
}
