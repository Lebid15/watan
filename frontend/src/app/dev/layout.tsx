"use client";
export const dynamic = 'force-dynamic'; // نجبر الصفحة أن تكون ديناميكية بلا pre-render ثابت
import DevNavbar from './DevNavbar';
import MobileZoomFrame from '@/components/MobileZoomFrame';
import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import api, { API_BASE_URL } from '@/utils/api';
import React from 'react';

class DevErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; err?: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, err: error }; }
  componentDidCatch(error: any, info: any) {
    if (typeof window !== 'undefined') {
      void ingestClientError({ name: error?.name, message: error?.message, stack: error?.stack, context: { react: info?.componentStack } });
    }
  }
  render() {
    if (this.state.hasError) return <div className="p-4 text-sm text-red-700 bg-red-50 rounded">حدث خطأ في الواجهة (تم تسجيله للمطور). أعد تحميل الصفحة.</div>;
    return this.props.children;
  }
}

function ingestClientError(payload: { name?: string; message: string; stack?: string; context?: any }) {
  try {
    if (process.env.NODE_ENV !== 'development') return; // محصور في التطوير فقط
    if (typeof window === 'undefined') return;
  const role = localStorage.getItem('role');
  if (role !== 'developer') return; // صلاحيات بعد التطبيع
    // استخدام fetch لتجنب تداخل interceptors
    fetch(`${API_BASE_URL}/dev/errors/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ source: 'frontend', level: 'error', ...payload }),
    }).catch(()=>{});
  } catch {}
}

function GlobalErrorHooks() {
  useEffect(() => {
    function onError(ev: ErrorEvent) {
      ingestClientError({ name: ev.error?.name, message: ev.message, stack: ev.error?.stack, context: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno } });
    }
    function onRejection(ev: PromiseRejectionEvent) {
      const reason: any = ev.reason || {};
      ingestClientError({ name: reason?.name, message: reason?.message || 'UnhandledRejection', stack: reason?.stack, context: { reason: String(reason) } });
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

function DevLayoutInner({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;
  const search = useSearchParams();
  const isMobileFrame = search.get('mobile') === '1';

  const shell = (
    <div className="min-h-screen bg-zinc-50 text-gray-950" style={{ minWidth: DESIGN_WIDTH, overflowX: 'auto' }}>
      <DevNavbar />
      <GlobalErrorHooks />
  {/* onRecoverableError logger for hydration diagnostics */}
  <HydrationDebug />
      <main className="mx-auto max-w-6xl p-4">
        <DevErrorBoundary>{children}</DevErrorBoundary>
      </main>
    </div>
  );

  if (isMobileFrame) {
    return (
      <div className="p-4">
        <MobileZoomFrame width={390}>{shell}</MobileZoomFrame>
      </div>
    );
  }
  return shell;
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DevLayoutInner>{children}</DevLayoutInner>
    </Suspense>
  );
}

function HydrationDebug() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Avoid overriding if already set
    if (!(window as any).__HYDRATION_DEBUG_SET__) {
      (window as any).__HYDRATION_DEBUG_SET__ = true;
      // React 18 exposes onRecoverableError global hook (set on window)
      (window as any).onRecoverableError = (err: any, info: any) => {
        try {
          // Shallow info extraction; info may contain componentStack
          // eslint-disable-next-line no-console
          console.warn('[HydrationMismatch]', err?.message, info);
        } catch {}
      };
    }
  }, []);
  return null;
}
