'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import api, { API_ROUTES } from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;

  const [authReady, setAuthReady] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const router = useRouter();
  const search = useSearchParams();

  // ====== تصغير ديناميكي على الشاشات الأصغر من 1280 ======
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : DESIGN_WIDTH;
      // تصغير بين 0.55 و 1 حسب عرض الجهاز
      const s = Math.min(1, Math.max(0.55, w / DESIGN_WIDTH));
      setScale(s);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  // تمكين الإطار المصغّر إذا الكشف ديناميكياً أو عبر بارامتر mobile=1
  const isMobileFrameParam = search.get('mobile') === '1';
  const useMobileScale = scale < 1 || isMobileFrameParam;
  // =======================================================

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

  // تحميل رسالة التنبيه العامة من localStorage
  const loadAlert = () => {
    try {
      const note = localStorage.getItem('adminGlobalAlert');
      setAlertMessage(note && note.trim() ? note.trim() : '');
    } catch {
      setAlertMessage('');
    }
  };

  // تحميل أولي + تحديث عند التركيز/تغير الرؤية/حدث مخصص
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
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('userPriceGroupId');
      localStorage.removeItem('token');
    } catch {}
    router.replace('/login');
  };

  if (!authReady) return null;

  // المحتوى الداخلي (بدون خصائص سكول أفقي)
  const innerCore = (
    <>
      <div className="bg-[var(--toppage)] text-gray-100">
        <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
      </div>
      <AdminNavbar />
      <div className="p-">{children}</div>
    </>
  );

  // حاوية الديسكتوب بعرض ثابت 1280
  const desktopContainer = (
    <div
      className="mx-auto"
      style={{ width: DESIGN_WIDTH, minWidth: DESIGN_WIDTH, minHeight: '100vh' }}
    >
      {innerCore}
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ overflowX: 'hidden' }}>
      {useMobileScale ? (
        // غلاف التصغير: يمنع السكرول الأفقي ويضبط التمرير العمودي
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <div
            style={{
              width: DESIGN_WIDTH,
              margin: '0 auto',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              minHeight: `calc(100vh / ${scale})`,
              willChange: 'transform',
            }}
          >
            {desktopContainer}
          </div>
        </div>
      ) : (
        desktopContainer
      )}
    </div>
  );
}
