'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearAuthArtifacts } from '@/utils/authCleanup';
import api, { API_ROUTES } from '@/utils/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  balance: number;
  currency: string; // رمز العملة (مبسّط)
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    // محاولة إضافية: قراءة التوكن من الكوكي إن لم يوجد في localStorage (حالة التحديث المبكر)
    let effectiveToken = token;
    if (!effectiveToken && typeof document !== 'undefined') {
      const ck = document.cookie.split('; ').find(c => c.startsWith('access_token='));
      if (ck) effectiveToken = decodeURIComponent(ck.split('=')[1] || '');
    }
    // تجنّب محاولة الجلب أثناء صفحة تسجيل الدخول عندما لا يوجد توكن
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    // لا نجلب أبداً أثناء التواجد في /login لتفادي أي 401 تشويشية أو سباق قبل إعادة التوجيه
    if (path === '/login') {
      setUser(null);
      setLoading(false);
      return;
    }

  if (!effectiveToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    // فك التوكن للحصول على معلومات أساسية (تستخدم كـ fallback إن فشل الجلب)
    let fallback: Partial<User> | null = null;
    let decodedRole: string | null = null;
    try {
  const payloadPart = (effectiveToken || '').split('.')[1];
      const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString());
      if (json?.sub) {
        decodedRole = (json.role || 'user').toLowerCase();
        fallback = {
          id: json.sub,
          email: json.email || '',
          name: json.fullName || json.email || 'User',
          role: (json.role || 'user').toLowerCase(),
          balance: 0,
          currency: 'USD', // افتراضي للمطور أو أي مستخدم بلا بيانات تفصيلية
        } as User;
      }
    } catch {}

    // جديد: في مسارات المطور (/dev) لا نحتاج بيانات tenant ولا رصيد دقيق الآن،
    // وغالباً ما يسبب الطلب 401 لعدم وجود tenant_host صالح. لذلك نستخدم fallback مباشرةً.
    if (typeof window !== 'undefined') {
      const pth = window.location.pathname || '';
      if (pth.startsWith('/dev') && decodedRole && ['developer','instance_owner'].includes(decodedRole)) {
        if (fallback) {
          setUser(fallback as User);
          setLoading(false);
          return; // تخطّي الجلب لتجنّب 401 التشويهي
        }
      }
    }

    // إن كنا في /dev ولا يوجد tenant_host (أي لم نحدد تينانت) والمستخدم مطوّر / مالك منصة → استخدم fallback وتخطي الطلب لتجنب 401
    if (typeof document !== 'undefined') {
      const noTenantCookie = !document.cookie.split('; ').some(c => c.startsWith('tenant_host='));
      // وسّعنا الشرط ليشمل /admin كذلك لحالات المالك أو المطوّر بدون اختيار تينانت بعد التحديث
      if ((path.startsWith('/dev') || path.startsWith('/admin')) && noTenantCookie && decodedRole && ['developer','instance_owner'].includes(decodedRole)) {
        if (fallback) {
          setUser(fallback as User);
          setLoading(false);
          return;
        }
      }
    }

    try {
      // جلب البيانات الشخصية فقط إذا كان التوكن موجودًا
      let res;
      try {
        res = await api.get<User>(API_ROUTES.users.profileWithCurrency, {
          headers: { 'Authorization': `Bearer ${effectiveToken}` },
        });
      } catch (e: any) {
        // في حالة 404 أو 501 أو مسار غير متاح، جرّب /users/profile كـ fallback (ليس مفيداً لــ 401)
        const status = e?.response?.status;
        if ([404, 500, 501].includes(status)) {
          try {
            res = await api.get<User>(API_ROUTES.users.profile, {
              headers: { 'Authorization': `Bearer ${effectiveToken}` },
            });
          } catch (e2) {
            throw e; // احتفظ بالخطأ الأصلي لو فشل fallback
          }
        } else if (status === 401) {
          // إعادة محاولة صامتة بعد 250ms (سباق خلال التحديث) لمرة واحدة فقط
          try {
            await new Promise(r => setTimeout(r, 250));
            const retryTokenLS = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            let retryToken = retryTokenLS;
            if (!retryToken && typeof document !== 'undefined') {
              const ck2 = document.cookie.split('; ').find(c => c.startsWith('access_token='));
              if (ck2) retryToken = decodeURIComponent(ck2.split('=')[1] || '');
            }
            if (retryToken && retryToken !== effectiveToken) {
              res = await api.get<User>(API_ROUTES.users.profileWithCurrency, {
                headers: { 'Authorization': `Bearer ${retryToken}` },
              });
            } else {
              throw e;
            }
          } catch (retryErr) {
            throw e; // أعد نفس الخطأ الأول لو فشلت الإعادة
          }
        } else {
          throw e;
        }
      }
      // قد يأتي backend بحقل currencyCode وليس currency، فنطبّق التطبيع
      const anyRes: any = res.data;
      const currency = anyRes.currencyCode || anyRes.currency || 'USD';
      setUser({
        id: anyRes.id,
        email: anyRes.email,
        name: anyRes.fullName || anyRes.email || 'User',
        role: anyRes.role || (fallback?.role ?? 'user'),
        balance: Number(anyRes.balance ?? 0),
        currency,
      });
    } catch (e: any) {
      // عند 401: لا نمسح التوكن أثناء التواجد في مناطق backoffice (/admin أو /dev) حتى لا نطرد المستخدم بسبب 401 عابر
      if (e?.response?.status === 401 && typeof window !== 'undefined') {
        const p = window.location.pathname || '';
        const inBackoffice = p.startsWith('/admin') || p.startsWith('/dev');
        const onAuthPages = p === '/login' || p === '/register';
        if (!inBackoffice && !onAuthPages) {
          // فقط في الصفحات العامة نمسح التوكن ونوجه المستخدم لتسجيل الدخول لاحقًا (التحويل يتم في interceptor)
          localStorage.removeItem('token');
          document.cookie = 'access_token=; Max-Age=0; path=/';
          document.cookie = 'role=; Max-Age=0; path=/';
        } else {
          // سجل للتشخيص بدون حذف التوكن
          // tslint:disable-next-line:no-console
          console.warn('[UserContext] 401 ignored in backoffice to avoid forced logout');
        }
      }
      // استخدم fallback إن وُجد لتقليل الوميض و401 التشويشية
      if (fallback) setUser(fallback as User); else setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      clearAuthArtifacts({ keepTheme: true });
      // استخدام replace حتى لا يرجع المستخدم للخلف بالتوكن القديم من الـ history
      window.location.replace('/login');
    }
  };

  // تأخير بسيط لإتاحة تهيئة الواجهات / الكوكي قبل الجلب الأول لتقليل 401 وقت التحديث
  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) refreshUser(); };
    // إذا لا يوجد توكن الآن جرّب بعد 150ms (قد يكون التخزين لم يُكتب بعد login redirect)
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      const t = setTimeout(run, 150);
      return () => { cancelled = true; clearTimeout(t); };
    }
    // انتظار microtask لضمان تحميل interceptors
    const t = setTimeout(run, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
