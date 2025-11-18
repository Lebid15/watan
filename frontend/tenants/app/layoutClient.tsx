'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import MobileDesktopViewport from '@/components/layout/MobileDesktopViewport';
import api, { API_ROUTES, Api } from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;
  const [authReady, setAuthReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shouldScaleForMobile, setShouldScaleForMobile] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const isMobileFrame = search.get('mobile') === '1';
  // رسالة التنبيه العامة (يتم ضبطها من صفحة المطور). نتركها فارغة إن لم تُحدد.
  const [alertMessage, setAlertMessage] = useState('');

  // ===== الشارات: الطلبات المعلقة =====
  const [pendingCount, setPendingCount] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshOrdersBadge = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      const res = await Api.admin.pendingOrders();
      const { count } = res.data as { count: number };
      setPendingCount(Number(count) || 0);
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setPendingCount(0);
    }
  }, []);

  // ===== الشارات: الإيداعات المعلقة =====
  const [pendingDepositsCount, setPendingDepositsCount] = useState<number>(0);
  const pollingDepositsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDepositsBadge = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      const res = await Api.admin.pendingDeposits();
      const { count } = res.data as { count: number };
      setPendingDepositsCount(Number(count) || 0);
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setPendingDepositsCount(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get(API_ROUTES.users.profileWithCurrency).catch((e: any) => e?.response);
        if (!mounted) return;
        if (!r || r.status === 401) {
          const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setAuthReady(true);
      } catch {
        if (!mounted) return;
        const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  // تحميل شارات الطلبات والإيداعات
  useEffect(() => {
    if (!authReady) return;
    
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    
    refreshOrdersBadge(ac1.signal);
    refreshDepositsBadge(ac2.signal);

    pollingRef.current = setInterval(() => {
      refreshOrdersBadge();
    }, 25_000);

    pollingDepositsRef.current = setInterval(() => {
      refreshDepositsBadge();
    }, 25_000);

    return () => {
      ac1.abort();
      ac2.abort();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (pollingDepositsRef.current) clearInterval(pollingDepositsRef.current);
    };
  }, [authReady, refreshOrdersBadge, refreshDepositsBadge]);

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

  // Detect touch/mobile devices to toggle the scaled desktop viewport behaviour.
  useEffect(() => {
    const detectMobile = () => {
      if (typeof window === 'undefined') return;
      const width = Math.min(window.innerWidth, window.outerWidth || window.innerWidth);
      const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isTouchCapable = maxTouchPoints > 0 || /Mobi|Android|iP(ad|hone)/i.test(userAgent);
      setShouldScaleForMobile(isTouchCapable && width < 1200);
    };

    detectMobile();
    window.addEventListener('resize', detectMobile);
    window.addEventListener('orientationchange', detectMobile);
    return () => {
      window.removeEventListener('resize', detectMobile);
      window.removeEventListener('orientationchange', detectMobile);
    };
  }, []);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('userPriceGroupId'); localStorage.removeItem('token'); } catch {}
    router.replace('/login');
  };

  if (!authReady) return null;
  
  const inner = (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative inset-y-0 right-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        <AdminSidebar onCloseMobile={() => setMobileMenuOpen(false)} />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar - ثابت */}
        <AdminTopBar 
          alertMessage={alertMessage} 
          onLogout={handleLogout}
          pendingOrdersCount={pendingCount}
          pendingDepositsCount={pendingDepositsCount}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        
        {/* Page Content - قابل للتمرير */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );

  const scaledLayout = (
    <MobileDesktopViewport designWidth={DESIGN_WIDTH}>{inner}</MobileDesktopViewport>
  );

  const finalLayout = shouldScaleForMobile ? scaledLayout : inner;

  const rootOverflowClass = shouldScaleForMobile ? 'overflow-hidden' : 'overflow-auto';

  return (
    <div className={`w-full min-h-screen ${rootOverflowClass}`}>
      {isMobileFrame ? (
        <div className="p-4">
          <MobileZoomFrame width={428} minScale={0.3}>
            <MobileDesktopViewport
              designWidth={DESIGN_WIDTH}
              viewportWidthOverride={428}
              viewportHeightOverride={926}
            >
              {inner}
            </MobileDesktopViewport>
          </MobileZoomFrame>
        </div>
      ) : (
        finalLayout
      )}
    </div>
  );
}
