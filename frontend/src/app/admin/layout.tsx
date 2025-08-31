// app/admin/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import api from '@/utils/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // عرض نسخة الديسكتوب كما هي بدون أي تصغير على الجوال
  // إزالة منطق التحجيم السابق لأنه سبّب منع التمرير والتكبير باللمس.
  const DESIGN_WIDTH = 1280;

  const [authReady, setAuthReady] = useState(false);

  const alertMessage = 'تنبيه: تم تحديث النظام، يرجى مراجعة صفحة الطلبات لمعرفة التفاصيل.';

  // لم نعد نمنع السكرول أو اللمس — نعرض العرض الكامل بعرض ثابت 1280 داخل سكرول عادي.

  // ✅ حارس إداري يعتمد على Api.me() (الكوكيز عبر backend) بدل localStorage
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
  const r = await api.get('/users/profile-with-currency').catch((e: any) => e?.response);
  if (!mounted) return;
  if (!r || r.status === 401) {
          // غير مسجّل → أعده للّوجين مع next
          const next = typeof window !== 'undefined' ? window.location.pathname : '/admin/dashboard';
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }

        // (اختياري): لو حاب تتأكد من الدور يمكنك قراءة الرد هنا
        // const { user } = await r.json();
        // if (!['admin','supervisor','owner'].includes(user.role)) router.replace('/');

        setAuthReady(true);
      } catch {
        if (!mounted) return;
        const next = typeof window !== 'undefined' ? window.location.pathname : '/admin/dashboard';
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  // زر الخروج — يمسح الكوكيز عبر الراوت الداخلي
  const handleLogout = async () => {
  try { await api.post('/auth/logout'); } catch {}
    // (اختياري) تنظيف أي تخزين محلي قديم
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('userPriceGroupId');
      localStorage.removeItem('token'); // لم نعد نعتمد عليه
    } catch {}
    router.replace('/login');
  };

  // لا نعرض شيئًا حتى يجهز التخطيط والتحقق من الجلسة، لتفادي الوميض والحلقات
  if (!authReady) return null;

  return (
    <div className="w-full min-h-screen overflow-auto">
      <div
        className="mx-auto"
        style={{
          width: DESIGN_WIDTH,
          minWidth: DESIGN_WIDTH,
          minHeight: '100vh',
          overflowX: 'auto',
        }}
      >
        <div className="bg-[var(--toppage)] text-gray-100">
          <AdminTopBar alertMessage={alertMessage} onLogout={handleLogout} />
        </div>

        <AdminNavbar />

        <div className="p-">{children}</div>
      </div>
    </div>
  );
}
