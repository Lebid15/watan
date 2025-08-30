// src/components/layout/MainHeader.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { formatGroupsDots } from '@/utils/format';

function currencySymbol(code?: string) {
  switch ((code || '').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    case 'EGP': return '£';
    case 'SAR': return '﷼';
    case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س';
    default: return code || '';
  }
}

export default function MainHeader() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ⬅️ خذ القيم الموجودة فعلًا في الـ Context
  const { user, refreshUser, logout } = useUser();

  // حدّث بيانات المستخدم عند تحميل الهيدر (لو فيه توكن)
  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // إغلاق القائمة عند النقر خارجها أو الضغط على Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const balanceNum = Number(user?.balance ?? 0);
  const balanceStr = isNaN(balanceNum) ? '0.00' : balanceNum.toFixed(2);

  // في UserContext النوع هو "currency" (وليس currencyCode)
  const curr = (user?.currency || 'USD').toUpperCase();
  const sym = currencySymbol(curr);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-bg-surface text-text-primary px-6 py-3 shadow">
      <div className="flex justify-between items-center">
        {/* اليسار: رصيد المحفظة + زر الحساب */}
        <div className="flex items-center gap-2" dir="rtl">
          <span
            className={[
              'text-[13px] font-bold px-3 py-0.5 rounded-full shadow border border-border',
              'bg-bg-surface-alt',
              balanceNum >= 0 ? 'text-success' : 'text-danger',
              'ml-3',
            ].join(' ')}
            title="رصيد المحفظة"
          >
            {formatGroupsDots(Number(balanceStr))} {sym}
          </span>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Account menu"
            >
              <FaUserCircle className="text-3xl" />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 menu text-text-primary z-[1000]"
              >
                <div className="py-1">
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user'); }}
                  >
                    الملف الشخصي
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user/passkeys'); }}
                  >
                    إدارة مفاتيح المرور
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/login?addPasskey=1'); }}
                  >
                    إضافة مفتاح مرور
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user/favorites'); }}
                  >
                    المفضلة
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user/security'); }}
                  >
                    الحماية
                  </button>

                  <div className="my-1 border-t border-border" />

                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt text-danger"
                    onClick={() => {
                      setOpen(false);
                      logout(); // ⬅️ استخدم دالة السياق
                    }}
                  >
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* اليمين: اسم المشروع + روابط دورية */}
        <div className="flex items-center gap-4 text-sm select-none">
          <div className="text-xl font-semibold">Kadro Store</div>
          {/* Role aware quick nav */}
          {user?.role === 'tenant_owner' && <nav className="hidden md:flex gap-3">
            <Link className="hover:underline" href="/tenant/products">Products</Link>
            <Link className="hover:underline" href="/tenant/users">Users</Link>
            <Link className="hover:underline" href="/tenant/price-groups">Price Groups</Link>
            <Link className="hover:underline" href="/tenant/reports">Reports</Link>
            <Link className="hover:underline" href="/billing/overview">Billing</Link>
          </nav>}
          {user?.role === 'distributor' && <nav className="hidden md:flex gap-3">
            <Link className="hover:underline" href="/distributor/products">Products</Link>
            <Link className="hover:underline" href="/distributor/price-groups">Price Groups</Link>
            <Link className="hover:underline" href="/distributor/orders">Orders</Link>
          </nav>}
          {/* تمت إزالة instance_owner (مُطبَّع إلى tenant_owner) */}
        </div>
      </div>
    </header>
  );
}
