"use client";
import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuthArtifacts, hasAccessTokenCookie } from '@/utils/authCleanup';
import MainHeader from '@/components/layout/MainHeader';
import BottomNav from '@/components/layout/BottomNav';
import { UserProvider } from '../context/UserContext';
import { ToastProvider } from '@/context/ToastContext';
import ThemeFab from '@/components/ThemeFab';
import i18n, { loadNamespace, setLocale } from '@/i18n/client';

// مزود بسيط لضمان إعادة العرض بعد تحميل الموارد
const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force(v => v + 1);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, []);
  return <>{children}</>;
};

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // تهيئة اللغة من localStorage أو الكوكيز
  useEffect(() => {
    try {
      let detected: string | null = null;
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
        if (m) detected = decodeURIComponent(m[1]);
      }
      if (!detected && typeof localStorage !== 'undefined') {
        detected = localStorage.getItem('locale');
      }
      if (!detected) detected = 'ar';
      setLocale(detected);
      loadNamespace(detected, 'common');
    } catch {}
  }, []);
  const hideHeaderFooter = pathname === '/login' || pathname === '/register' || pathname === '/password-reset';
  const isBackoffice = pathname?.startsWith('/admin') || pathname?.startsWith('/dev');
  const hasRoleAreaLayout =
    pathname?.startsWith('/tenant') ||
    pathname?.startsWith('/distributor') ||
    pathname?.startsWith('/owner');

  const router = useRouter();
  useEffect(() => {
    if (pathname !== '/login') return;
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) {
      // لا يوجد توكن: تنظيف فتات الدور القديم فقط
      if (!hasAccessTokenCookie()) {
        try { document.cookie = 'role=; Max-Age=0; path=/'; } catch {}
      }
      return; // ابق في صفحة الدخول
    }
    // لدينا توكن: بدل مسحه (يُسبب حلقة إعادة تحميل) نحدد ما إذا كنا على نطاق فرعي ونوجه مباشرةً
    let role: string | null = null;
    try {
      if (token && typeof token === 'string' && token.includes('.')) {
        const parts = token.split('.');
        if (parts.length === 3 && parts[1] && typeof parts[1] === 'string') {
          const payloadPart = parts[1];
          if (!payloadPart || typeof payloadPart !== 'string') return;
          const b64 = payloadPart.replace(/-/g,'+').replace(/_/g,'/');
          const json = JSON.parse(atob(b64));
          role = (json?.role || '').toLowerCase();
          if (role && ['instance_owner','owner','admin'].includes(role)) role = 'tenant_owner';
        }
      }
    } catch {}
    const host = window.location.host;
    const parts = host.split('.');
    const isSub = parts.length >= 3 && !['www','app'].includes(parts[0]);
    // إذا كنا على الـ apex والدور ليس developer → هنا فقط نحافظ على السلوك القديم بمسح التوكن
    if (!isSub) {
      if (role !== 'developer') {
        clearAuthArtifacts({ keepTheme: true });
        console.info('[AuthCleanup] cleared token on apex /login (non-developer)');
        return;
      }
      // developer على الـ apex → توجهه مباشرةً إلى /dev
      router.replace('/dev');
      return;
    }
    // نطاق فرعي + لدينا توكن: وجه إلى المسار المناسب حسب الدور
    let dest = '/';
  if (role === 'tenant_owner') dest = '/admin/dashboard';
  else if (role === 'distributor') dest = '/admin/distributor';
  else if (role === 'user') dest = '/';
    else if (role === 'developer') {
      // مطوّر من ساب دومين → أعده إلى الـ apex (قد يكون خطأ إعداد، نعيده للـ apex ثم /dev)
      const apex = (process.env.NEXT_PUBLIC_APEX_DOMAIN || '').toLowerCase().replace(/\/$/, '') || parts.slice(-2).join('.');
      const proto = window.location.protocol;
      dest = `${proto}//${apex}/dev`;
    }
    router.replace(dest);
  }, [pathname, router]);


  return (
    <ToastProvider>
      <I18nProvider>
        <UserProvider>
          {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <ThemeFab />}
          {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <MainHeader />}
          <main
            className={`${
              !hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout
                ? 'pb-20 pt-20'
                : ''
            } relative z-0`}
          >
            {children}
          </main>
          {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <BottomNav />}
        </UserProvider>
      </I18nProvider>
    </ToastProvider>
  );
}
