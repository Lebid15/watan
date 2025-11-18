'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  FiHome,
  FiGlobe,
  FiPackage,
  FiDollarSign,
  FiBell,
  FiActivity,
  FiSettings,
  FiMenu,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiUsers,
  FiShoppingBag,
  FiCreditCard,
  FiDatabase,
  FiAlertCircle,
  FiBarChart2,
} from 'react-icons/fi';

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

interface SuperAdminSidebarProps {
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export default function SuperAdminSidebar({ isMobileMenuOpen, onCloseMobileMenu }: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('superadminSidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const navItems: NavItem[] = [
    {
      name: 'لوحة المعلومات',
      icon: <FiHome size={20} />,
      href: '/dashboard',
    },
    {
      name: 'المستأجرون',
      icon: <FiGlobe size={20} />,
      href: '/subdomains',
    },
    {
      name: 'المنتجات',
      icon: <FiPackage size={20} />,
      href: '/catalog',
    },
    {
      name: 'الفواتير والاشتراكات',
      icon: <FiDollarSign size={20} />,
      subItems: [
        { name: 'باقات الاشتراك', href: '/billing/plans', icon: <FiCreditCard size={16} /> },
        { name: 'الفواتير', href: '/billing/invoices', icon: <FiDollarSign size={16} /> },
        { name: 'الإحصائيات', href: '/billing/stats', icon: <FiBarChart2 size={16} /> },
      ],
    },
    {
      name: 'الإشعارات',
      icon: <FiBell size={20} />,
      href: '/notifications',
    },
    {
      name: 'مراقبة النظام',
      icon: <FiActivity size={20} />,
      subItems: [
        { name: 'سجل الأخطاء', href: '/errors', icon: <FiAlertCircle size={16} /> },
        { name: 'قاعدة البيانات', href: '/stats/database', icon: <FiDatabase size={16} /> },
        { name: 'الأداء', href: '/stats/performance', icon: <FiActivity size={16} /> },
      ],
    },
    {
      name: 'الإعدادات',
      icon: <FiSettings size={20} />,
      href: '/settings',
    },
  ];

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('superadminSidebarCollapsed', String(newState));
    }
    if (newState) {
      setOpenDropdown(null);
    }
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
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
    <>
      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={onCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          h-screen bg-bg-surface border-e border-border flex flex-col shrink-0 transition-all duration-300 overflow-hidden
          ${isCollapsed ? 'w-20' : 'w-64'}
          
          /* Mobile styles */
          lg:relative lg:translate-x-0
          fixed top-0 right-0 z-40
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Logo + Toggle */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2 shrink-0">
          {!isCollapsed && (
            <h2 className="text-lg font-bold text-text-primary text-center flex-1">
              Super Admin
            </h2>
          )}
          <button
            onClick={toggleSidebar}
            className="hidden lg:block p-2 rounded-lg hover:bg-primary/10 text-text-primary transition-colors"
            title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-label={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          >
            {isCollapsed ? <FiMenu size={24} /> : <FiX size={24} />}
          </button>
          
          {/* Close button for mobile */}
          <button
            onClick={onCloseMobileMenu}
            className="lg:hidden p-2 rounded-lg hover:bg-primary/10 text-text-primary transition-colors"
            aria-label="إغلاق القائمة"
          >
            <FiX size={24} />
          </button>
        </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto custom-scrollbar">
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
                        {item.icon}
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderBadge(item.badge, 'inline')}
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
                            flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all
                            ${subActive 
                              ? 'bg-primary/15 text-text-primary font-semibold shadow-sm' 
                              : 'hover:bg-primary/10 text-text-secondary'
                            }
                          `}
                          onClick={() => {
                            setOpenDropdown(null);
                            onCloseMobileMenu();
                          }}
                        >
                          {sub.icon}
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
                            flex h-10 w-10 items-center justify-center rounded-xl border transition-colors
                            ${subActive
                              ? 'border-primary bg-primary text-white'
                              : 'border-transparent bg-bg-surface-alt hover:border-primary/40 hover:bg-primary/15 text-text-secondary'
                            }
                          `}
                          title={sub.name}
                          onClick={() => {
                            setOpenDropdown(null);
                            onCloseMobileMenu();
                          }}
                        >
                          {sub.icon}
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
                  ? 'bg-primary/15 text-text-primary font-semibold shadow-sm' 
                  : 'hover:bg-primary/10 text-text-primary'
                }
              `}
              title={isCollapsed ? item.name : ''}
              onClick={onCloseMobileMenu}
            >
              {isCollapsed ? (
                <div className="relative flex items-center justify-center">
                  {item.icon}
                  {renderBadge(item.badge, 'floating')}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  {renderBadge(item.badge, 'inline')}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-border shrink-0">
          <div className="text-xs text-text-secondary text-center">
            <p className="font-semibold">Ahla Store</p>
            <p className="text-[10px] mt-1 opacity-75">v1.0.0 SuperAdmin</p>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
