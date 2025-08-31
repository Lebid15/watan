// src/app/admin/AdminNavbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Api } from '@/utils/api';
import { FiList, FiUsers, FiDollarSign, FiShare2 } from 'react-icons/fi';

interface NavItem {
  name: string;
  href?: string;
  subItems?: { name: string; href: string }[];
}

export default function AdminNavbar() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') === true;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  useEffect(() => setOpenDropdown(null), [pathname]);

  const navItems: NavItem[] = [
    { name: 'لوحة التحكم', href: '/admin/dashboard' },
    { name: 'المنتجات', href: '/admin/products' },
    { name: 'الطلبات', href: '/admin/orders' },
    { name: 'المستخدمون', href: '/admin/users' },
    {
      name: 'الدفعات',
      subItems: [
        { name: 'وسائل الدفع', href: '/admin/payments/methods' },
        { name: 'طلبات الإيداع', href: '/admin/payments/deposits' },
      ],
    },
    {
      name: 'التقارير',
      subItems: [
        { name: 'الأرباح', href: '/admin/reports/profits' },
        { name: 'جرد رأس المال', href: '/admin/reports/capital' },
      ],
    },
    {
      name: 'الإعدادات',
      subItems: [
        { name: 'الإشعارات', href: '/admin/notifications' },
        { name: 'المظهر', href: '/admin/settings/theme' },
        { name: 'من نحن', href: '/admin/settings/about' },
        { name: 'تعليمات', href: '/admin/settings/infoes' },
      ],
    },
  ];

  const itemText = 'text-[15px]';

  // ===== الشارات: الطلبات المعلقة =====
  const [pendingCount, setPendingCount] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshOrdersBadge(signal?: AbortSignal) {
    try {
  const res = await Api.admin.pendingOrders();
  const { count } = res.data as { count: number };
      setPendingCount(Number(count) || 0);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      // لا نطبع أخطاء خارج مسارات الأدمن
      if (isAdminRoute) console.error('خطأ عند جلب الطلبات المعلقة', e);
      setPendingCount(0);
    }
  }

  useEffect(() => {
    // شغّل فقط داخل /admin
    if (!isAdminRoute) return;

    const ac = new AbortController();
    refreshOrdersBadge(ac.signal);

    pollingRef.current = setInterval(() => {
      refreshOrdersBadge();
    }, 25_000);

    return () => {
      ac.abort();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isAdminRoute]);

  // ===== الشارات: الإيداعات المعلقة =====
  const [pendingDepositsCount, setPendingDepositsCount] = useState<number>(0);
  const pollingDepositsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshDepositsBadge(signal?: AbortSignal) {
    try {
  const res = await Api.admin.pendingDeposits();
  const { count } = res.data as { count: number };
      setPendingDepositsCount(Number(count) || 0);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (isAdminRoute) console.error('خطأ عند جلب الإيداعات المعلقة', e);
      setPendingDepositsCount(0);
    }
  }

  useEffect(() => {
    // شغّل فقط داخل /admin
    if (!isAdminRoute) return;

    const ac = new AbortController();
    refreshDepositsBadge(ac.signal);

    pollingDepositsRef.current = setInterval(() => {
      refreshDepositsBadge();
    }, 25_000);

    return () => {
      ac.abort();
      if (pollingDepositsRef.current) clearInterval(pollingDepositsRef.current);
    };
  }, [isAdminRoute]);

  return (
    <div className="bg-bg-surface-alt border-b border-border">
      <nav className="py-2 admin-container">
        <div className="w-full flex items-center justify-between gap-2 flex-wrap">
          {/* الروابط الأساسية */}
          <div className="inline-flex flex-wrap items-center gap-1 bg-bg-surface text-text-primary border border-border rounded-md px-2 md:px-3 py-1 w-max">
            {navItems.map((item) => {
              const isActive = item.href ? pathname.startsWith(item.href) : false;

              if (item.subItems) {
                const opened = openDropdown === item.name;
                return (
                  <div key={item.name} className="relative">
                    <button
                      onClick={() => setOpenDropdown(opened ? null : item.name)}
                      className={[
                        itemText,
                        'px-2 py-1 rounded-md transition flex items-center gap-1 whitespace-nowrap',
                        opened
                          ? 'bg-primary/15 text-text-primary ring-1 ring-primary/40'
                          : 'hover:bg-primary/10',
                      ].join(' ')}
                    >
                      {item.name}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {opened && (
                      <div
                        className="absolute end-0 mt-2 w-56 bg-bg-surface text-text-primary border border-border rounded-md shadow-lg z-50 overflow-hidden"
                        onMouseLeave={() => setOpenDropdown(null)}
                      >
                        {item.subItems.map((sub) => {
                          const subActive = pathname.startsWith(sub.href);
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={[
                                'block px-4 py-2 text-sm transition',
                                subActive ? 'bg-primary/20 text-text-primary' : 'hover:bg-primary/10 text-text-primary',
                              ].join(' ')}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={[
                    'px-3 py-2 rounded-md transition whitespace-nowrap',
                    isActive ? 'bg-primary/30 text-text-primary ring-1 ring-primary/40' : 'hover:bg-primary/10',
                  ].join(' ')}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* كبسولة أيقونات مختصرة */}
          <div className="inline-flex items-center gap-2">
            <div className="inline-flex items-center gap-5 bg-[rgb(var(--color-bg-surface))] text-[rgb(var(--color-text-primary))] border border-[rgb(var(--color-border))] rounded-md px-2 md:px-3 py-1 w-max">
              {/* الطلبات */}
              <Link
                href="/admin/orders"
                className="p-1 rounded hover:bg-[rgb(var(--color-primary))]/10"
                title={pendingCount > 0 ? `الطلبات (${pendingCount} جديد)` : 'الطلبات'}
              >
                <FiList
                  size={22}
                  className={pendingCount > 0 ? 'text-yellow-500' : 'text-[rgb(var(--color-text-primary))]'}
                />
              </Link>

              {/* الدفعات (إيداعات) */}
              <Link
                href="/admin/payments/deposits"
                className="p-1 rounded hover:bg-[rgb(var(--color-primary))]/10"
                title={
                  pendingDepositsCount > 0 ? `طلبات الإيداع (${pendingDepositsCount} جديد)` : 'الدفعات'
                }
              >
                <FiDollarSign
                  size={22}
                  className={
                    pendingDepositsCount > 0 ? 'text-yellow-500' : 'text-[rgb(var(--color-text-primary))]'
                  }
                />
              </Link>

              {/* المستخدمون */}
              <Link
                href="/admin/users"
                className="p-1 rounded hover:bg-[rgb(var(--color-primary))]/10"
                title="المستخدمون"
              >
                <FiUsers size={22} />
              </Link>

              {/* إعدادات API للمنتجات */}
              <Link
                href="/admin/products/api-settings"
                className="p-1 rounded hover:bg-[rgb(var(--color-primary))]/10"
                title="الإعدادات"
              >
                <FiShare2 size={22} />
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
