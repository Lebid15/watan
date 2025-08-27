"use client";
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { clearAuthArtifacts, hasAccessTokenCookie } from '@/utils/authCleanup';
import MainHeader from '@/components/layout/MainHeader';
import BottomNav from '@/components/layout/BottomNav';
import { UserProvider } from '../context/UserContext';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/context/ToastContext';
import ThemeFab from '@/components/ThemeFab';
import PasskeyPrompt from '@/components/auth/PasskeyPrompt';

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideHeaderFooter = pathname === '/login' || pathname === '/register';
  const isBackoffice = pathname?.startsWith('/admin') || pathname?.startsWith('/dev');
  const hasRoleAreaLayout = pathname?.startsWith('/tenant') || pathname?.startsWith('/distributor') || pathname?.startsWith('/owner');

  useEffect(() => {
    if (pathname === '/login') {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        clearAuthArtifacts({ keepTheme: true });
        // tslint:disable-next-line:no-console
        console.info('[AuthCleanup] purged leftover token on /login');
      } else if (!hasAccessTokenCookie()) {
        try { document.cookie = 'role=; Max-Age=0; path=/'; } catch {}
      }
    }
  }, [pathname]);

  return (
    <ToastProvider>
  <I18nProvider>
  <UserProvider>
  {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <ThemeFab />}
  {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <MainHeader />}
  <main className={`${!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout ? 'pb-20 pt-20' : ''} relative z-0`}>
          {children}
        </main>
  {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <PasskeyPrompt />}
  {!hideHeaderFooter && !isBackoffice && !hasRoleAreaLayout && <BottomNav />}
  </UserProvider>
  </I18nProvider>
    </ToastProvider>
  );
}
