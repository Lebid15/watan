'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import SuperAdminSidebar from './SuperAdminSidebar';
import SuperAdminTopBar from './SuperAdminTopBar';
import {
  clearSuperAdminToken,
  getSuperAdminToken,
  superadminApi,
  type SuperAdminProfile,
} from '@/lib/superadminApi';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<SuperAdminProfile | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const nextTarget = () => {
      if (typeof window === 'undefined') return pathname;
      return window.location.pathname + window.location.search;
    };
    async function bootstrap() {
      const token = getSuperAdminToken();
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(nextTarget())}`);
        return;
      }
      try {
        const me = await superadminApi.profile();
        if (!cancelled) {
          setProfile(me);
          setAuthReady(true);
        }
      } catch (error) {
        clearSuperAdminToken();
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(nextTarget())}`);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    clearSuperAdminToken();
    setProfile(null);
    router.replace('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <SuperAdminSidebar 
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={closeMobileMenu}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <SuperAdminTopBar 
          onLogout={handleLogout}
          onToggleMobileMenu={toggleMobileMenu}
          currentUserName={profile?.display_name || profile?.email}
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </main>
      </div>
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </div>
  );
}
