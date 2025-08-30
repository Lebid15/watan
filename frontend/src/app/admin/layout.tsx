// app/admin/layout.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavbar from './AdminNavbar';
import AdminTopBar from './AdminTopBar';
import { Api } from '@/utils/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const DESIGN_WIDTH = 1280;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 👇 جاهزية تخطيط الواجهة (تصغير/تكبير)
  const [scale, setScale] = useState(1);
  const [layoutReady, setLayoutReady] = useState(false);
  const [withTransition, setWithTransition] = useState(false);

  // 👇 جاهزية التحقق من الجلسة
  const [authReady, setAuthReady] = useState(false);

  const alertMessage = 'تنبيه: تم تحديث النظام، يرجى مراجعة صفحة الطلبات لمعرفة التفاصيل.';

  // حساب المقياس بحيث تُعرض الصفحة كاملة (عرضاً وارتفاعاً) بلا سكرول على الجوال والآيباد
  const applyLayout = (useAnim: boolean) => {
    if (!wrapperRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // نحفظ التحويل الحالي ثم نعيده لاحقاً لتفادي وميض كبير
    const prevTransform = canvas.style.transform;

    // نجبر القياس على الحجم الأصلي (scale 1) لمعرفة الارتفاع الحقيقي بدون تأثير التصغير السابق
    canvas.style.transform = 'translateX(-50%) scale(1)';
    const unscaledHeight = canvas.scrollHeight; // الارتفاع الفعلي الكامل

    const w = Math.max(320, window.innerWidth);
    const h = Math.max(320, window.innerHeight);

    const widthScale = Math.min(w / DESIGN_WIDTH, 1);
    const heightScale = Math.min(h / unscaledHeight, 1);
    const s = Math.min(widthScale, heightScale); // اختيار الأصغر لضمان احتواء كامل الصفحة

    setScale(s);
    wrapperRef.current.style.height = `${unscaledHeight * s}px`;
    setWithTransition(useAnim);

    // نعيد التحويل (سيتم استبداله بقيمة scale عبر JSX اعتماداً على state)
    canvas.style.transform = prevTransform;
  };

  // حساب التخطيط قبل الطلاء الأول لمنع القفزة
  useLayoutEffect(() => {
    applyLayout(false);
    setLayoutReady(true);
    // تفعيل منع السكرول على الجسم في هذه الصفحات
    if (typeof document !== 'undefined') {
      document.body.classList.add('desktop-fixed-no-scroll');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // إزالة الكلاس عند الخروج من التخطيط
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('desktop-fixed-no-scroll');
      }
    };
  }, []);

  // استجابة لتغير المقاس/المحتوى
  useEffect(() => {
    const onResize = () => applyLayout(true);
    window.addEventListener('resize', onResize);

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => applyLayout(true))
        : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ حارس إداري يعتمد على Api.me() (الكوكيز عبر backend) بدل localStorage
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
  const r = await Api.me().catch((e) => e?.response);
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
  try { await Api.logout(); } catch {}
    // (اختياري) تنظيف أي تخزين محلي قديم
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('userPriceGroupId');
      localStorage.removeItem('token'); // لم نعد نعتمد عليه
    } catch {}
    router.replace('/login');
  };

  // لا نعرض شيئًا حتى يجهز التخطيط والتحقق من الجلسة، لتفادي الوميض والحلقات
  if (!layoutReady || !authReady) return null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        ref={canvasRef}
        className="admin-mobile-boost"
        suppressHydrationWarning
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: DESIGN_WIDTH,
          // نطبّق نفس التحويل بعد حساب scale النهائي
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          transition: withTransition ? 'transform 120ms linear' : 'none',
          willChange: 'transform',
          visibility: 'visible',
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
