// src/components/layout/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { performLogout } from '@/utils/logout';
import { useEffect, useMemo, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
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

type DepositStatus = 'pending' | 'approved' | 'rejected';

interface SheetItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  helper?: string;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkingPendingDeposit, setCheckingPendingDeposit] = useState(false);
  const [hasPendingDeposit, setHasPendingDeposit] = useState(false);

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

  const depositEndpoints = useMemo(() => {
    const depositsRoutes = API_ROUTES.payments.deposits as typeof API_ROUTES.payments.deposits & {
      legacyMine?: string | null;
    };
    return [depositsRoutes.mine, depositsRoutes.legacyMine]
      .filter((u): u is string => typeof u === 'string' && !!u);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    let cancelled = false;

    const normalize = (payload: any): Array<{ status?: DepositStatus | string }> => {
      if (Array.isArray(payload)) return payload as Array<{ status?: DepositStatus | string }>;
      if (payload?.items && Array.isArray(payload.items)) return payload.items;
      if (payload?.results && Array.isArray(payload.results)) return payload.results;
      return [];
    };

    const fetchPendingDeposits = async () => {
      setCheckingPendingDeposit(true);
      setHasPendingDeposit(false);

      try {
        for (const endpoint of depositEndpoints) {
          try {
            const { data } = await api.get(endpoint, {
              params: { limit: 20 },
            });

            if (cancelled) return;

            const list = normalize(data);
            const found = list.some((entry) => String(entry?.status ?? '').toLowerCase() === 'pending');
            if (found) {
              setHasPendingDeposit(true);
              return;
            }
          } catch {
            // Try the next endpoint (legacy fallback)
            continue;
          }
        }
      } finally {
        if (!cancelled) {
          setCheckingPendingDeposit(false);
        }
      }
    };

    fetchPendingDeposits();
    return () => {
      cancelled = true;
    };
  }, [menuOpen, depositEndpoints]);

  // عناصر القائمة (Bottom Sheet)
  const sheetItems = useMemo<SheetItem[]>(() => {
    const addFundsHelper = checkingPendingDeposit
      ? 'جارٍ التحقق من وجود طلب إيداع قيد المعالجة...'
      : hasPendingDeposit
      ? 'لديك طلب إيداع قيد المعالجة. انتظر الموافقة قبل إرسال طلب جديد.'
      : undefined;

    const base: SheetItem[] = [
      {
        label: 'إضافة رصيد',
        href: '/payments/deposits',
        Icon: HiCurrencyDollar,
        disabled: checkingPendingDeposit || hasPendingDeposit,
        helper: addFundsHelper,
      },
      { label: 'سجل المحفظة', href: '/wallet/transactions', Icon: HiCreditCard },
      { label: 'تعليمات', href: '/user/infoes', Icon: HiCog },
      { label: 'من نحن', href: '/user/about', Icon: HiInformationCircle },
    ];

    if (billingEnabled) {
      base.push(
        { label: 'الفوترة - نظرة عامة', href: '/billing/overview', Icon: HiCurrencyDollar },
        { label: 'الفوترة - الفواتير', href: '/billing/invoices', Icon: HiCurrencyDollar },
        { label: 'دفع فاتورة', href: '/billing/pay', Icon: HiCurrencyDollar },
      );
    }

    base.push({
      label: 'تسجيل خروج',
      href: '/login',
      Icon: HiLogout,
      onClick: () => performLogout(),
    });

    return base;
  }, [billingEnabled, checkingPendingDeposit, hasPendingDeposit]);

  return (
    <>
      <nav
        className="fixed bottom-0 w-full z-40 bg-bg-surface border-t border-border"
        role="navigation"
        aria-label="التنقّل السفلي"
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
                  aria-label={key === 'menu' ? 'فتح القائمة' : undefined}
                >
                  <Icon size={26} />
                  {showBadge && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-danger text-[rgb(var(--color-primary-contrast))] text-xs font-bold flex items-center justify-center shadow"
                      aria-label={`لديك ${unreadCount} إشعارات غير مقروءة`}
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
      {menuOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة الخيارات"
        >
          {/* خلفية معتمة */}
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuOpen(false)}
            aria-label="إغلاق الخلفية"
          />

          {/* اللوحة السفلية */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-bg-surface rounded-t-2xl shadow-2xl border border-border p-4 pb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-text-primary font-semibold">القائمة</h3>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded hover:bg-bg-surface-alt"
                aria-label="إغلاق"
              >
                <HiX size={22} className="text-text-primary" />
              </button>
            </div>

            <ul className="divide-y divide-border">
              {sheetItems.map((item) => {
                const { label, href, Icon, onClick, disabled, helper } = item;
                return (
                  <li key={href} className="py-1">
                    {disabled ? (
                      <div className="flex items-center gap-3 py-3 rounded-md px-2 bg-bg-surface-alt opacity-60 cursor-not-allowed">
                        <Icon size={22} className="text-text-secondary" />
                        <span className="text-text-secondary">{label}</span>
                      </div>
                    ) : (
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
                    )}
                    {helper && (
                      <div className="pr-9 pt-1 text-xs text-warning">{helper}</div>
                    )}
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
