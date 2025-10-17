// src/app/admin/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Api } from '@/utils/api';
import {
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiUsers,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiChevronDown,
  FiChevronUp,
  FiChevronRight,
  FiMenu,
  FiX,
  FiCreditCard,
  FiArrowDownCircle,
  FiTrendingUp,
  FiPieChart,
  FiBell,
  FiMonitor,
  FiInfo,
  FiLifeBuoy,
  FiUnlock,
  FiShield,
  FiImage,
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

interface SubNavItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavItem {
  name: string;
  icon: React.ReactNode;
  href?: string;
  subItems?: SubNavItem[];
  badge?: number;
}

export default function AdminSidebar() {
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminSidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {
        /* silent */
      }
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') === true;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshOrdersBadge = useCallback(
    async (signal?: AbortSignal) => {
      try {
        if (signal?.aborted) return;
        const res = await Api.admin.pendingOrders();
        const { count } = res.data as { count: number };
        setPendingCount(Number(count) || 0);
      } catch (error: unknown) {
        if ((error as { name?: string })?.name === 'AbortError') return;
        if (isAdminRoute) console.error('خطأ عند جلب الطلبات المعلقة', error);
        setPendingCount(0);
      }
    },
    [isAdminRoute],
  );

  useEffect(() => {
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
  }, [isAdminRoute, refreshOrdersBadge]);

  const [pendingDepositsCount, setPendingDepositsCount] = useState<number>(0);
  const pollingDepositsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDepositsBadge = useCallback(
    async (signal?: AbortSignal) => {
      try {
        if (signal?.aborted) return;
        const res = await Api.admin.pendingDeposits();
        const { count } = res.data as { count: number };
        setPendingDepositsCount(Number(count) || 0);
      } catch (error: unknown) {
        if ((error as { name?: string })?.name === 'AbortError') return;
        if (isAdminRoute) console.error('خطأ عند جلب الإيداعات المعلقة', error);
        setPendingDepositsCount(0);
      }
    },
    [isAdminRoute],
  );

  useEffect(() => {
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
  }, [isAdminRoute, refreshDepositsBadge]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!sidebarRef.current) return;
      if (!sidebarRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!namespaceReady) {
    return null;
  }


  const navItems: NavItem[] = [
    {
      name: t('nav.dashboard'),
      icon: <FiHome size={20} />,
      href: '/admin/dashboard',
    },
    {
      name: t('tenant.products'),
      icon: <FiPackage size={20} />,
      href: '/admin/products',
    },
    {
      name: t('orders.pageTitle'),
      icon: <FiShoppingCart size={20} />,
      href: '/admin/orders',
      badge: pendingCount,
    },
    {
      name: t('users.pageTitle'),
      icon: <FiUsers size={20} />,
      href: '/admin/users',
    },
    {
      name: t('payments.nav.group'),
      icon: <FiDollarSign size={20} />,
      badge: pendingDepositsCount,
      subItems: [
        { name: t('payments.nav.methods'), href: '/admin/payments/methods', icon: <FiCreditCard size={16} /> },
        { name: t('payments.nav.deposits'), href: '/admin/payments/deposits', icon: <FiArrowDownCircle size={16} /> },
      ],
    },
    {
      name: t('reports.nav.group'),
      icon: <FiBarChart2 size={20} />,
      subItems: [
        { name: t('reports.nav.profits'), href: '/admin/reports/profits', icon: <FiTrendingUp size={16} /> },
        { name: t('reports.nav.capital'), href: '/admin/reports/capital', icon: <FiPieChart size={16} /> },
      ],
    },
    {
      name: t('settings.nav.group'),
      icon: <FiSettings size={20} />,
      subItems: [
        { name: t('settings.nav.notifications'), href: '/admin/notifications', icon: <FiBell size={16} /> },
        { name: 'صور السلايدر', href: '/admin/settings/banners', icon: <FiImage size={16} /> },
        { name: t('settings.nav.theme'), href: '/admin/settings/theme', icon: <FiMonitor size={16} /> },
        { name: t('settings.nav.about'), href: '/admin/settings/about', icon: <FiInfo size={16} /> },
        { name: t('settings.nav.help'), href: '/admin/settings/infoes', icon: <FiLifeBuoy size={16} /> },
        { name: t('settings.nav.passwordReset'), href: '/admin/settings/password-reset', icon: <FiUnlock size={16} /> },
        { name: t('settings.nav.security'), href: '/admin/settings/security', icon: <FiShield size={16} /> },
      ],
    },
  ];

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // حفظ الحالة في localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminSidebarCollapsed', String(newState));
    }
    // إغلاق القوائم المنسدلة عند التصغير
    if (!isCollapsed) {
      setOpenDropdown(null);
    }
  };

  const renderBadge = (count?: number, variant: 'inline' | 'floating' = 'inline') => {
    if (typeof count !== 'number') return null;
    const isPositive = count > 0;
    const displayValue = count > 99 ? '99+' : `${count}`;
    const base = 'text-[10px] font-bold flex items-center justify-center rounded-full transition-all duration-200';
    const palette = isPositive ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-500 text-white/80 shadow';
    if (variant === 'floating') {
      return (
        <span
          className={`absolute -top-2 -end-2 min-w-[18px] h-[18px] ${base} ${palette} ${isPositive ? 'border-2 border-bg-surface' : 'border border-gray-400'} z-10`}
          aria-hidden="true"
        >
          {displayValue}
        </span>
      );
    }
    return (
      <span
        className={`min-w-[20px] h-[20px] px-1.5 ${base} ${palette} ${isPositive ? 'border border-transparent' : 'border border-gray-400'}`}
        aria-hidden="true"
      >
        {displayValue}
      </span>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      className={`
        min-h-screen bg-bg-surface border-e border-border flex flex-col shrink-0 transition-all duration-300
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Logo / Title + Toggle Button */}
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        {!isCollapsed && (
          <h2 className="text-xl font-bold text-text-primary text-center flex-1">
            لوحة التحكم
          </h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-primary/10 text-text-primary transition-colors"
          title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          aria-label={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
        >
          {isCollapsed ? <FiMenu size={24} /> : <FiX size={24} />}
        </button>
      </div>

      {/* Navigation */}
  <nav className={`flex-1 p-2 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {navItems.map((item) => {
          const isActive = item.href ? pathname.startsWith(item.href) : false;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isOpen = openDropdown === item.name;

          if (hasSubItems) {
            return (
              <div key={item.name} className="relative mb-1">
                <button
                  onClick={() => toggleDropdown(item.name)}
                  className={`
                    relative w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3 px-4 py-3 rounded-lg transition-all
                    ${isOpen ? 'bg-primary/15 text-text-primary' : 'hover:bg-primary/10 text-text-primary'}
                  `}
                  title={isCollapsed ? item.name : ''}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                >
                  {isCollapsed ? (
                    <div className="relative flex flex-col items-center justify-center gap-2">
                      <div className="relative flex items-center justify-center">
                        {item.icon}
                        {renderBadge(item.badge, 'floating')}
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleDropdown(item.name);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleDropdown(item.name);
                          }
                        }}
                        className={`
                          inline-flex h-6 w-6 items-center justify-center text-text-primary
                          transition-transform ${isOpen ? 'rotate-180' : ''}
                          cursor-pointer select-none hover:text-primary
                        `}
                        aria-label={isOpen ? 'إخفاء العناصر' : 'عرض العناصر'}
                      >
                        <FiChevronDown size={14} />
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div>{item.icon}</div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {renderBadge(item.badge)}
                        {isOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                      </div>
                    </>
                  )}
                </button>

                {!isCollapsed && isOpen && (
                  <div className="mt-1 mr-8 space-y-1">
                    {item.subItems!.map((sub) => {
                      const subActive = pathname.startsWith(sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all
                            ${subActive 
                              ? 'bg-primary/25 text-text-primary font-medium' 
                              : 'hover:bg-primary/10 text-text-secondary'
                            }
                          `}
                          onClick={() => setOpenDropdown(null)}
                        >
                          {sub.icon && <span className="text-text-secondary">{sub.icon}</span>}
                          <span>{sub.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {isCollapsed && isOpen && (
                  <div className="mt-2 flex flex-col items-center gap-2">
                    {item.subItems!.map((sub) => {
                      const subActive = pathname.startsWith(sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`
                            flex h-10 w-10 items-center justify-center rounded-xl border text-text-secondary transition-colors
                            ${subActive
                              ? 'border-primary bg-primary text-white'
                              : 'border-transparent bg-bg-surface-alt hover:border-primary/40 hover:bg-primary/15'
                            }
                          `}
                          title={sub.name}
                          aria-label={sub.name}
                          onClick={() => setOpenDropdown(null)}
                        >
                          {sub.icon ?? <FiChevronRight size={16} />}
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
              className={`
                relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3 px-4 py-3 rounded-lg transition-all mb-1
                ${isActive 
                  ? 'bg-primary/25 text-text-primary font-medium ring-1 ring-primary/40' 
                  : 'hover:bg-primary/10 text-text-primary'
                }
              `}
              title={isCollapsed ? item.name : ''}
            >
              {isCollapsed ? (
                <div className="relative">
                  {item.icon}
                  {renderBadge(item.badge, 'floating')}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div>{item.icon}</div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {renderBadge(item.badge)}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
