// src/components/layout/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { performLogout } from '@/utils/logout';
import { useEffect, useMemo, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';
import {
  HiHome,
  HiShoppingCart,
  HiCreditCard,
  HiBell,
  HiMenu,
  HiX,
  HiCurrencyDollar,
  HiCog,
  HiInformationCircle, // ← جديد
  HiLogout,
} from 'react-icons/hi';

interface NavItem {
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  key: string;
}

interface SheetItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {}
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  const billingEnabled = process.env.NEXT_PUBLIC_FEATURE_BILLING_V1 === 'true';
  const items: NavItem[] = [
    { key: 'home', href: '/', Icon: HiHome },
    { key: 'orders', href: '/orders', Icon: HiShoppingCart },
    { key: 'wallet', href: '/wallet', Icon: HiCreditCard },
    { key: 'notifications', href: '/notifications', Icon: HiBell },
    // نُبقي href = /menu كما هو، لكن سنمنع الانتقال عند الضغط ونفتح القائمة
    { key: 'menu', href: '/menu', Icon: HiMenu },
  ];

  // جلب عدد الإشعارات غير المقروءة
  const loadUnread = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return setUnreadCount(0);
      const res = await api.get<{ id: string; isRead: boolean }[]>(
        API_ROUTES.notifications.my,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const count = res.data.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);
      setUnreadCount(count);
    } catch {
      // تجاهل الخطأ بصمت في النافبار
    }
  };

  useEffect(() => {
    if (pathname.startsWith('/notifications')) {
      setUnreadCount(0);
    } else {
      loadUnread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // إغلاق الـ Bottom Sheet بـ Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // عناصر القائمة (Bottom Sheet)
  const sheetItems = useMemo<SheetItem[]>(() => {
    if (!namespaceReady) return [];
    
    const base: SheetItem[] = [
      { label: t('menu.walletTransactions'), href: '/wallet/transactions', Icon: HiCreditCard },
      { label: t('menu.instructions'), href: '/user/infoes', Icon: HiCog },
      { label: t('menu.aboutUs'), href: '/user/about', Icon: HiInformationCircle },
    ];

    if (billingEnabled) {
      base.push(
        { label: t('menu.billingOverview'), href: '/billing/overview', Icon: HiCurrencyDollar },
        { label: t('menu.billingInvoices'), href: '/billing/invoices', Icon: HiCurrencyDollar },
        { label: t('menu.payInvoice'), href: '/billing/pay', Icon: HiCurrencyDollar },
      );
    }

    base.push({
      label: t('menu.logout'),
      href: '/login',
      Icon: HiLogout,
      onClick: () => performLogout(),
    });

    return base;
  }, [billingEnabled, t, namespaceReady]);

  return (
    <>
      <nav
        className="fixed bottom-0 w-full z-40 bg-bg-surface border-t border-border"
        role="navigation"
        aria-label={namespaceReady ? t('menu.bottomNavigation') : 'التنقّل السفلي'}
      >
        <ul className="flex justify-around py-1">
          {items.map(({ href, Icon, key }) => {
            const isActive = href === '/' ? pathname === href : pathname.startsWith(href);
            const showBadge = key === 'notifications' && unreadCount > 0 && !pathname.startsWith('/notifications');
            const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

            return (
              <li key={href} className="flex-1 flex justify-center">
                <Link
                  href={href}
                  onClick={(e) => {
                    if (key === 'notifications') setUnreadCount(0);
                    if (key === 'menu') {
                      e.preventDefault(); // منع الانتقال لمسار /menu
                      setMenuOpen(true);
                    }
                  }}
                  className={[
                    'relative flex items-center justify-center rounded-xl transition-colors',
                    'h-14 w-14 sm:h-16 sm:w-16',
                    isActive
                      ? 'bg-subnav text-text-primary ring-1 ring-primary/40'
                      : 'text-text-primary hover:bg-bg-surface-alt',
                  ].join(' ')}
                  aria-label={key === 'menu' && namespaceReady ? t('menu.openMenu') : undefined}
                >
                  <Icon size={26} />
                  {showBadge && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-danger text-[rgb(var(--color-primary-contrast))] text-xs font-bold flex items-center justify-center shadow"
                      aria-label={namespaceReady ? t('menu.unreadNotifications', { count: unreadCount }) : `لديك ${unreadCount} إشعارات غير مقروءة`}
                    >
                      {badgeText}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {/* حافة آمنة لأجهزة iOS ذات الـ home indicator */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Bottom Sheet */}
      {menuOpen && namespaceReady && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={t('menu.title')}
        >
          {/* خلفية معتمة */}
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuOpen(false)}
            aria-label={t('menu.closeBackground')}
          />

          {/* اللوحة السفلية */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-bg-surface rounded-t-2xl shadow-2xl border border-border p-4 pb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-text-primary font-semibold">{t('menu.title')}</h3>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded hover:bg-bg-surface-alt"
                aria-label={t('menu.close')}
              >
                <HiX size={22} className="text-text-primary" />
              </button>
            </div>

            <ul className="divide-y divide-border">
              {sheetItems.map((item) => {
                const { label, href, Icon, onClick } = item;
                return (
                  <li key={href} className="py-1">
                    <Link
                      href={href}
                      onClick={() => {
                        if (onClick) onClick();
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-3 py-3 rounded-md px-2 hover:bg-bg-surface-alt"
                    >
                      <Icon size={22} className="text-text-primary" />
                      <span className="text-text-primary">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
