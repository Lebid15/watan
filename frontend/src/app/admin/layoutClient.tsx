'use client';
import { useEffect, useRef, useState } from 'react';
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

  // ===== Global Scaling Mode =====
  // We always render at DESIGN_WIDTH (desktop layout). If viewport narrower, we scale the entire canvas.
  // Scale is persisted per session to reduce jank between navigations.
  const SCALE_KEY = 'adminGlobalScaleV1';
  const DISABLE_SCALE = process.env.NEXT_PUBLIC_DISABLE_ADMIN_SCALE === '1';
  const [scale, setScale] = useState(1);
  const scaledOuterRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Compute & persist scale
  useEffect(() => {
  if (DISABLE_SCALE) return; // skip scale logic entirely
  const compute = () => {
      const w = window.innerWidth;
      // Only scale down if viewport < design width; never upscale.
      let next = w < DESIGN_WIDTH ? +(w / DESIGN_WIDTH).toFixed(4) : 1;
      try {
        sessionStorage.setItem(SCALE_KEY, String(next));
      } catch {}
      setScale(next);
    };
    // Try load previous value first (optimistic) to avoid flash.
    try {
      const prev = sessionStorage.getItem(SCALE_KEY);
      if (prev) {
        const v = parseFloat(prev); if (!isNaN(v) && v > 0 && v <= 1.2) setScale(v);
      }
    } catch {}
    compute();
    const onResize = () => { compute(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ResizeObserver to adjust the outer wrapper height to scaled content height.
  useEffect(() => {
  if (DISABLE_SCALE) return; // no observer needed
  if (!canvasRef.current || !scaledOuterRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const h = e.contentRect.height;
        if (scaledOuterRef.current) {
          // Height after scale = original height * scale
            scaledOuterRef.current.style.height = (h * scale) + 'px';
        }
      }
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [scale]);

  // Entire admin canvas (unscaled natural size)
  const canvas = (
    <div ref={canvasRef} style={{ width: DESIGN_WIDTH, minWidth: DESIGN_WIDTH }} className="flex flex-col min-h-screen mx-auto">
      <div className="bg-[var(--toppage)] text-gray-100 w-full">
        <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
      </div>
      <AdminNavbar />
      <div className={'py-4'}>
        {children}
      </div>
    </div>
  );

  const inner = DISABLE_SCALE ? (
    <div className="w-full overflow-y-auto overflow-x-auto" dir="rtl">
      {canvas}
    </div>
  ) : (
    <div
      ref={scaledOuterRef}
      className="relative w-full overflow-y-auto overflow-x-hidden" 
      style={{
        // Provide at least full viewport height; ResizeObserver will update exact height.
        minHeight: '100vh'
      }}
      dir="rtl"
    >
      <div
        style={{
          width: DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: 'top right', // RTL: anchor right edge so left side doesn't drift off-screen
        }}
      >
        {canvas}
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
