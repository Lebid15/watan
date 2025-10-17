 'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminTopBar from './AdminTopBar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import api, { API_ROUTES, Api } from '@/utils/api';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;
  const [authReady, setAuthReady] = useState(false);
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

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('userPriceGroupId'); localStorage.removeItem('token'); } catch {}
    router.replace('/login');
  };

  if (!authReady) return null;
  
  const inner = (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - ثابت */}
      <AdminSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar - ثابت */}
        <AdminTopBar 
          alertMessage={alertMessage} 
          onLogout={handleLogout}
          pendingOrdersCount={pendingCount}
          pendingDepositsCount={pendingDepositsCount}
        />
        
        {/* Page Content - قابل للتمرير */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </main>
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
