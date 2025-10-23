'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import TotpVerification from '@/components/TotpVerification';
import { loadNamespace } from '@/i18n/client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

type LoginPayload = {
  role?: string;
  email?: string;
  user?: { email?: string | null };
  totpPending?: boolean;
  requiresTotp?: boolean;
};

const HOST_TENANT_OVERRIDES: Record<string, string> = {
  'shamtech.localhost': 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536',
  'alsham.localhost': '7d37f00a-22f3-4e61-88d7-2a97b79d86fb',
};

const normalizeHost = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  const withoutPort = trimmed.split(':')[0];
  return withoutPort || null;
};

const readCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const pattern = `${name}=`;
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .find(chunk => chunk.startsWith(pattern))
    ?.slice(pattern.length) || null;
};

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpPhase, setTotpPhase] = useState<'none' | 'verify'>('none');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const pendingTenantIdRef = useRef<string | null>(null);
  const { t, i18n: i18nextInstance } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const activeLocale = i18nextInstance.language || i18nextInstance.resolvedLanguage || 'ar';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setNamespaceReady(false);
      try {
        await loadNamespace(activeLocale, 'common');
      } finally {
        if (active) {
          setNamespaceReady(true);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [activeLocale]);

  const finalizeNavigation = useCallback((token: string) => {
  let nextDest: string | null = null;
    try {
      const url = new URL(window.location.href);
      const candidate = url.searchParams.get('next');
      if (candidate && /^\//.test(candidate) && !/^\/api\b/.test(candidate)) {
        nextDest = candidate;
      }
    } catch {}
    try {
      if (token && token.includes('.')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const json = JSON.parse(atob(b64));
          const rr = (json?.role || '').toLowerCase();
          const email = (json?.email || json?.user?.email || '').toLowerCase();
          const norm = (rr === 'instance_owner' || rr === 'owner' || rr === 'admin') ? 'tenant_owner' : rr;
          const envList = (process.env.NEXT_PUBLIC_DEVELOPER_EMAILS || process.env.DEVELOPER_EMAILS || '')
            .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
          const whitelist = envList.length ? envList : ['alayatl.tr@gmail.com'];
          // Determine subdomain vs apex correctly (handle *.localhost and ports)
          const host = window.location.hostname; // no port
          let isSub = false; let apexHost = host;
          if (/\.localhost$/i.test(host)) {
            const parts = host.split('.');
            const sub = parts[0]?.toLowerCase();
            if (sub && !['www','app','localhost'].includes(sub)) {
              isSub = true;
              apexHost = 'localhost';
            }
          } else {
            const parts = host.split('.');
            if (parts.length > 2) {
              const sub = parts[0]?.toLowerCase();
              if (!['www','app','api'].includes(sub)) {
                isSub = true;
                apexHost = parts.slice(-2).join('.');
              }
            }
          }
          const configuredApex = (process.env.NEXT_PUBLIC_APEX_DOMAIN || '').toLowerCase().replace(/\/$/, '');
          const isApex = !isSub;
          if (norm === 'developer') {
            if (!email || !whitelist.includes(email)) {
              document.cookie = 'access_token=; Max-Age=0; path=/';
              document.cookie = 'role=; Max-Age=0; path=/';
              localStorage.removeItem('token');
              setError(t('login.error.developerEmailNotAllowed'));
              return;
            }
          } else if (isApex) {
            // In dev localhost, treat as tenant portal rather than blocking
            if (apexHost === 'localhost') {
              // continue
            } else {
            document.cookie = 'access_token=; Max-Age=0; path=/';
            document.cookie = 'role=; Max-Age=0; path=/';
            localStorage.removeItem('token');
            setError(t('login.error.apexOnlyDeveloper'));
            return;
            }
          }
          const defaultDest = (() => {
            if (isSub) {
              if (norm === 'tenant_owner') return '/admin/dashboard';
              if (norm === 'distributor') return '/admin/distributor';
              if (norm === 'user') return '/';
              if (norm === 'developer') {
                const apex = configuredApex || apexHost;
                return `${window.location.protocol}//${apex}/dev`;
              }
              return '/';
            }
            return '/dev';
          })();
          if (nextDest) {
            if (nextDest.startsWith('/dev') && norm !== 'developer') nextDest = defaultDest;
            if (isApex && norm !== 'developer') nextDest = defaultDest;
          } else {
            nextDest = defaultDest;
          }
        }
      }
    } catch {}
    try { router.push(nextDest || '/'); } catch { window.location.href = nextDest || '/'; }
  }, [router, t]);

  const ensureTenantContext = useCallback(async (token: string, fallbackTenantId?: string | null) => {
    if (!token) return null;
    let resolvedTenantId: string | null = null;

    const candidateHosts = new Set<string>();
    try {
      if (typeof window !== 'undefined') {
        const host = normalizeHost(window.location.hostname);
        if (host) candidateHosts.add(host);
      }
    } catch {}
    const cookieHost = normalizeHost(readCookieValue('tenant_host'));
    if (cookieHost) candidateHosts.add(cookieHost);

    for (const host of candidateHosts) {
      const override = host ? HOST_TENANT_OVERRIDES[host] : null;
      if (override) {
        resolvedTenantId = override;
        break;
      }
    }

    // أولاً حاول الحصول على المعرّف من /tenants/current لأنها تستخدم الـ host لحل التينانت الحالي
    if (!resolvedTenantId) {
      try {
        const currentTenantRes = await api.get('/tenants/current', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantIdFromCurrent = (currentTenantRes?.data as any)?.tenantId || (currentTenantRes?.data as any)?.tenant_id;
        if (tenantIdFromCurrent) {
          resolvedTenantId = String(tenantIdFromCurrent);
        }
      } catch (err) {
        console.warn('Failed to resolve tenant via /tenants/current', err);
      }
    }

    // إذا لم ننجح فاستخرج من ملف التعريف (قد يُرجع tenant المرتبط بالمستخدم)
    if (!resolvedTenantId) {
      try {
        const profileRes = await api.get('/users/profile-with-currency', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = profileRes?.data ?? {};
        resolvedTenantId =
          payload?.tenant?.id ??
          payload?.tenantId ??
          payload?.tenant_id ??
          payload?.user?.tenant?.id ??
          payload?.user?.tenantId ??
          payload?.user?.tenant_id ??
          null;
      } catch (err) {
        console.warn('Failed to resolve tenant via profile endpoint', err);
      }
    }

    const finalTenantId = (resolvedTenantId || fallbackTenantId || '').trim();
    if (finalTenantId) {
      try { localStorage.setItem('tenant_id', finalTenantId); } catch {}
      try { document.cookie = `tenant_id=${finalTenantId}; Path=/; Max-Age=${60*60*24*7}`; } catch {}
      return finalTenantId;
    }
    return null;
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); 
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await api.post('/auth/login', 
        { emailOrUsername: identifier, password }, 
        { 
          validateStatus: () => true,
          signal: controller.signal,
          timeout: 30000
        }
      );
      
      clearTimeout(timeoutId);
      if (res.status >= 300) {
        throw new Error((res.data as any)?.message || t('login.error.generic'));
      }
      
  const token = (res.data as any).token || (res.data as any).access_token;
  const tenantIdFromResponse = (res.data as any)?.user?.tenantId || (res.data as any)?.user?.tenant_id || null;
      pendingTenantIdRef.current = tenantIdFromResponse || null;
      
      if (!token) {
        throw new Error(t('login.error.tokenMissing'));
      }
      
      // لا نضع التوكن في الكوكيز قبل إكمال التحقق الثنائي إن لزم.
      // نخزّنه مؤقتًا تحت مفتاح مؤقت.
      try {
        localStorage.setItem('pre_token', token);
      } catch {}
      // استخراج الحمولة لمعرفة هل ننتقل مباشرة أو نطلب TOTP
  let payload: LoginPayload | null = null;
      try {
        const part = token.split('.')[1];
        payload = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
        if (payload?.role) document.cookie = `role=${payload.role}; Path=/; Max-Age=${60*60*24*7}`;
      } catch {}

      const needsTotp = !!(payload?.totpPending || payload?.requiresTotp);
      if (needsTotp) {
        setPendingToken(token);
        setTotpPhase('verify');
        return; // لا نُكمل التوجيه الآن
      }
      // لا حاجة لخطوة TOTP: رَفّع التوكن مباشرة
      try {
        localStorage.setItem('token', token);
        document.cookie = `access_token=${token}; Path=/; Max-Age=${60*60*24*7}`;
      } catch {}
      try {
        await ensureTenantContext(token, tenantIdFromResponse);
      } catch (err) {
        console.warn('Unable to persist tenant context after login', err);
      }
      pendingTenantIdRef.current = null;
      finalizeNavigation(token);
      
    } catch (error) {
      console.error('Login error:', error);

      const err = error as { name?: string; code?: string; message?: string };
      const message = typeof err.message === 'string' ? err.message : undefined;

      if (err.name === 'AbortError') {
        setError(t('login.error.timeout'));
      } else if (err.code === 'ECONNABORTED' || message?.includes('timeout')) {
        setError(t('login.error.timeoutNetwork'));
      } else if (message?.includes('Network Error')) {
        setError(t('login.error.network'));
      } else {
        setError(message || t('login.error.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!namespaceReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  return (
  <div className="min-h-screen w-full bg-[var(--bg-main)] flex justify-center relative">
      <div className="w-full max-w-md rounded-none sm:rounded-2xl shadow-2xl overflow-hidden bg-white flex flex-col">
        <div className="relative h-56 sm:h-64">
          <img src="/pages/loginbg.svg" alt="Login Illustration" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-600/60 via-sky-600/30 to-transparent" />
          <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,224L60,208C120,192,240,160,360,160C480,160,600,192,720,208C840,224,960,224,1080,202.7C1200,181,1320,139,1380,117.3L1440,96L1440,320L0,320Z" fill="#ffffff" />
          </svg>
        </div>
  <form onSubmit={submit} className="p-5 sm:p-7 space-y-4 -mt-8 sm:-mt-10 relative z-10">
          <h1 className="text-2xl font-semibold text-center mb-2 text-gray-900">{t('login.title')}</h1>
          {error && <div className="text-center text-red-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">{t('login.identifier.label')}</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                {/* User icon (inline SVG) */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z"/><path d="M3.5 21c1.916-3.419 5.223-5 8.5-5s6.584 1.581 8.5 5"/></svg>
              </span>
              <input value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" className="w-full border rounded pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 placeholder-gray-400 bg-white" placeholder={t('login.identifier.placeholder')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">{t('login.password.label')}</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                {/* Lock icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="w-full border rounded pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 placeholder-gray-400 bg-white" placeholder={t('login.password.placeholder')} />
              <button type="button" onClick={()=>setShowPassword(p=>!p)} aria-label={showPassword ? t('login.password.hide') : t('login.password.show')} className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 hover:text-gray-700 focus:outline-none" tabIndex={-1}>
                {showPassword ? (
                  // Eye-off icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  // Eye icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
            <button disabled={loading || !identifier || !password} className="w-full bg-sky-600 text-white py-2 rounded text-sm disabled:opacity-60 hover:brightness-110 transition">{loading? t('login.loading') : t('login.submit')}</button>
          <div className="flex justify-between text-xs text-gray-600">
            <a href="/password-reset" className="underline">{t('login.forgot')}</a>
            <a href="/verify-email" className="underline">{t('login.verifyEmail')}</a>
          </div>
          <p className="text-center text-xs text-gray-600 pt-2">{t('login.noAccount')} <a href="/register" className="text-sky-600 underline">{t('login.register')}</a></p>
        </form>
      </div>
      {/* لغة في أعلى يمين الصفحة */}
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      {totpPhase === 'verify' && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5">
              <TotpVerification
              onSuccess={async (finalTok) => {
                // finalTok هنا هو رمز التحقق المدخل، نحتاج أخذ التوكن النهائي من localStorage بعد ترقية TotpVerification
                const promoted = localStorage.getItem('token') || pendingToken || '';
                if (promoted) {
                  try {
                    await ensureTenantContext(promoted, pendingTenantIdRef.current);
                  } catch (err) {
                    console.warn('Failed to ensure tenant after TOTP', err);
                  }
                }
                pendingTenantIdRef.current = null;
                setTotpPhase('none');
                finalizeNavigation(promoted);
              }}
              onCancel={() => { setTotpPhase('none'); setError(t('login.error.totpCanceled')); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
