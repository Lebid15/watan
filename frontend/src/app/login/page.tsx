'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import { usePasskeys } from '@/hooks/usePasskeys';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authenticateWithPasskey, registerPasskey, loading: passkeyLoading, error: passkeyError } = usePasskeys();
  const [addingPasskey, setAddingPasskey] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/login', { emailOrUsername: identifier, password }, { validateStatus: () => true });
      if (res.status >= 300) throw new Error((res.data as any)?.message || 'فشل الدخول');
      const token = (res.data as any).token || (res.data as any).access_token;
      localStorage.setItem('token', token);
      document.cookie = `access_token=${token}; Path=/; Max-Age=${60*60*24*7}`;
      // استخرج الدور من التوكن (Base64 URL) وضعه في كوكي ليستفيد منه middleware
      try {
        const payloadPart = token.split('.')[1];
        const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(b64));
        if (json?.role) {
          document.cookie = `role=${json.role}; Path=/; Max-Age=${60*60*24*7}`;
        }
      } catch {}
      // تحديد مسار الوجهة:
      // 1) احترام باراميتر next إن وُجد (ومسار داخلي آمن)
      // 2) وإلا اختر حسب الدور
      let nextDest: string | null = null;
      // سنقوم دائماً بفك التوكن وفرض القيود (حتى لو وُجد query next) ثم بعد السماح نقرر الوجهة
      let decodedRole = '';
      try {
        const url = new URL(window.location.href);
        const candidate = url.searchParams.get('next');
        if (candidate && /^\//.test(candidate) && !/^\/api\b/.test(candidate)) {
          nextDest = candidate; // سنعيد التحقق لاحقاً
        }
      } catch {}
      try {
        const payloadPart = token.split('.')[1];
        const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(b64));
        const rr = (json?.role || '').toLowerCase();
        const email = (json?.email || json?.user?.email || '').toLowerCase();
        decodedRole = rr;
        let norm = (rr === 'instance_owner' || rr === 'owner' || rr === 'admin') ? 'tenant_owner' : rr;
        const envList = (process.env.NEXT_PUBLIC_DEVELOPER_EMAILS || process.env.DEVELOPER_EMAILS || '')
          .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
        const whitelist = envList.length ? envList : ['alayatl.tr@gmail.com'];
        const host = window.location.host;
        const hostParts = host.split('.');
        let isSub = false; let apexHost = host;
        if (hostParts.length >= 3) {
          const sub = hostParts[0];
          if (sub && !['www','app'].includes(sub)) { isSub = true; apexHost = hostParts.slice(-2).join('.'); }
        }
        const configuredApex = (process.env.NEXT_PUBLIC_APEX_DOMAIN || '').toLowerCase().replace(/\/$/, '');
        const isApex = !isSub;
        if (norm === 'developer') {
          if (!email || !whitelist.includes(email)) {
            document.cookie = 'access_token=; Max-Age=0; path=/';
            document.cookie = 'role=; Max-Age=0; path=/';
            localStorage.removeItem('token');
            setError('غير مسموح: بريد غير مُخوَّل (قائمة المطورين)');
            setLoading(false);
            return;
          }
        } else if (isApex) {
          document.cookie = 'access_token=; Max-Age=0; path=/';
          document.cookie = 'role=; Max-Age=0; path=/';
          localStorage.removeItem('token');
          setError('الدخول عبر النطاق الرئيسي مقصور على المطوّر. استخدم نطاق المتجر (subdomain).');
          setLoading(false);
          return;
        }
        // الآن تحديد الوجهة (إذا كانت nextDest موجودة نتحقق من صلاحيتها)
        const defaultDest = (() => {
          if (isSub) {
            if (norm === 'tenant_owner') return '/admin/dashboard';
            if (norm === 'distributor') return '/admin/distributor';
            if (norm === 'user') return '/app';
            if (norm === 'developer') {
              const apex = configuredApex || apexHost;
              return `${window.location.protocol}//${apex}/dev`;
            }
            return '/';
          }
          return '/dev'; // apex + developer
        })();
        // حماية: لو query next تشير إلى /dev لكن المستخدم ليس developer (لم يحدث return أعلاه لأنها ساب دومين) نلغيها
        if (nextDest) {
          if (nextDest.startsWith('/dev') && norm !== 'developer') nextDest = defaultDest;
          if (isApex && norm !== 'developer') nextDest = defaultDest; // should not happen due للمنع
        } else {
          nextDest = defaultDest;
        }
      } catch { nextDest = '/'; }
      router.push(nextDest);
    } catch (e:any) {
      setError(e?.message || 'فشل الدخول');
    } finally { setLoading(false); }
  };

  const doPasskeyLogin = async () => {
    if (!identifier) { setError('أدخل بريدك أو اسم المستخدم أولاً'); return; }
    try {
  await authenticateWithPasskey(identifier);
  // دفع إلى الجذر ثم middleware يتولى التوجيه حسب الدور
  router.push('/');
    } catch {/* handled in hook */}
  };

  const doRegisterPasskey = async () => {
    if (!localStorage.getItem('token')) { setError('سجّل الدخول أولاً لإضافة مفتاح'); return; }
    setAddingPasskey(true);
    try { await registerPasskey('جهازي'); } catch {/* hook error */} finally { setAddingPasskey(false); }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] flex justify-center">
      <div className="w-full max-w-md rounded-none sm:rounded-2xl shadow-2xl overflow-hidden bg-white flex flex-col">
        <div className="relative h-56 sm:h-64">
          <img src="/pages/loginbg.svg" alt="Login Illustration" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-600/60 via-sky-600/30 to-transparent" />
          <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,224L60,208C120,192,240,160,360,160C480,160,600,192,720,208C840,224,960,224,1080,202.7C1200,181,1320,139,1380,117.3L1440,96L1440,320L0,320Z" fill="#ffffff" />
          </svg>
        </div>
  <form onSubmit={submit} className="p-5 sm:p-7 space-y-4 -mt-8 sm:-mt-10 relative z-10">
          <h1 className="text-2xl font-semibold text-center mb-2 text-gray-900">تسجيل الدخول</h1>
          {error && <div className="text-center text-red-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">البريد الإلكتروني أو اسم المستخدم</label>
            <input value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 placeholder-gray-400 bg-white" placeholder="example@mail.com" />
          </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">كلمة المرور</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 placeholder-gray-400 bg-white" placeholder="••••••••" />
            </div>
            <button disabled={loading || !identifier || !password} className="w-full bg-sky-600 text-white py-2 rounded text-sm disabled:opacity-60 hover:brightness-110 transition">{loading? '...' : 'دخول'}</button>
          <div className="flex justify-between text-xs text-gray-600">
            <a href="/password-reset" className="underline">نسيت كلمة المرور؟</a>
            <a href="/verify-email" className="underline">التحقق من البريد</a>
          </div>
          <div className="pt-4 space-y-3 border-t">
            <div className="text-center text-sm font-medium">أو استخدم مفاتيح المرور</div>
            <button type="button" onClick={doPasskeyLogin} disabled={passkeyLoading || !identifier} className="w-full bg-emerald-600 text-white py-2 rounded text-sm hover:brightness-110 disabled:opacity-50 transition">
              {passkeyLoading ? '...' : 'دخول بـ Passkey'}
            </button>
            <button type="button" onClick={doRegisterPasskey} disabled={addingPasskey || passkeyLoading} className="w-full bg-gray-700 text-white py-2 rounded text-sm hover:brightness-110 disabled:opacity-50 transition">
              {addingPasskey || passkeyLoading ? '...' : 'إضافة Passkey (بعد تسجيل الدخول)'}
            </button>
            {passkeyError && <div className="text-xs text-red-600 text-center">{passkeyError}</div>}
          </div>
          <p className="text-center text-xs text-gray-600 pt-2">لا تملك حساباً؟ <a href="/register" className="text-sky-600 underline">إنشاء حساب</a></p>
        </form>
      </div>
    </div>
  );
}
