'use client';

import { useState, useEffect } from 'react';
import ResponsiveCurrencySelect from '@/components/ResponsiveCurrencySelect';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { loadNamespace } from '@/i18n/client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface Currency {
  id: string;
  name: string;
  code: string;
  symbolAr?: string | null;
  isPrimary?: boolean;
}

interface RegisterContextResponse {
  currencies: Currency[];
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t, i18n: i18nextInstance } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const activeLocale = i18nextInstance.language || i18nextInstance.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    const ensureNamespace = async () => {
      setNamespaceReady(false);
      try {
        await loadNamespace(activeLocale, 'common');
      } finally {
        if (mounted) {
          setNamespaceReady(true);
        }
      }
    };
    ensureNamespace();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  // جلب العملات من الباك إند
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const res = await api.get<RegisterContextResponse>(API_ROUTES.auth.registerContext);
        const list = Array.isArray(res.data?.currencies) ? res.data.currencies : [];
        setCurrencies(list);

        // اختيار العملة الأساسية أو الليرة السورية افتراضيًا إذا وُجدت
        const preferred =
          list.find((c) => c.isPrimary) ||
          list.find((c) => c.code === 'SYP') ||
          list[0];
        if (preferred) setCurrencyId(preferred.id);
      } catch (err) {
        console.error('Failed to fetch currencies', err);
      }
    };
    fetchCurrencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currencyId) {
      setError(t('register.error.currencyRequired'));
      return;
    }

    setLoading(true);
    try {
  // استخدم مسار auth/register (عام) بدلاً من users/register (محمي بحارس JWT)
  await api.post(API_ROUTES.auth.register, {
        email,
        password,
        fullName,
        username,
        currencyId,
      });
      alert(t('register.success'));
      router.push('/login');
    } catch (error) {
      const fallback = t('register.error.generic');
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
        setError(typeof message === 'string' ? message : fallback);
      } else {
        setError(fallback);
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
      {/* ✅ أزلنا overflow-hidden لأنه كان يقطع منسدلة الـ select في الإنتاج */}
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-visible bg-white flex flex-col">
        {/* الهيدر */}
        <div className="relative h-64 sm:h-72">
          <img
            src="/pages/loginbg.svg"
            alt="Register Illustration"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,118,255,0.65) 0%, rgba(0,118,255,0.35) 55%, rgba(255,255,255,0) 100%), radial-gradient(60% 50% at 50% 0%, rgba(0,118,255,0.35) 0%, rgba(0,118,255,0) 70%)',
            }}
          />
          <svg
            className="absolute -bottom-1 left-0 w-full"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              d="M0,224L60,208C120,192,240,160,360,160C480,160,600,192,720,208C840,224,960,224,1080,202.7C1200,181,1320,139,1380,117.3L1440,96L1440,320L0,320Z"
              fill="#ffffff"
            />
          </svg>
        </div>

        {/* الفورم */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 -mt-8 sm:-mt-10 relative z-10">
          <h2 className="text-2xl font-semibold text-center mb-4 text-gray-900">
            {t('register.title')}
          </h2>

          {error && <div className="mb-4 text-red-600 text-center">{error}</div>}

          {/* الاسم الكامل */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="fullName">
            {t('register.fullName.label')}
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full mb-3 px-3 py-1 border border-gray-300 rounded bg-white text-gray-900"
            autoComplete="name"
          />

          {/* اسم المستخدم */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="username">
            {t('register.username.label')}
          </label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full mb-3 px-3 py-1 border border-gray-300 rounded bg-white text-gray-900"
            autoComplete="username"
          />

          {/* البريد الإلكتروني */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="email">
            {t('register.email.label')}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-3 px-3 py-1 border border-gray-300 rounded bg-white text-gray-900"
            autoComplete="email"
          />

          {/* كلمة المرور */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="password">
            {t('register.password.label')}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 px-3 py-1 border border-gray-300 rounded bg-white text-gray-900"
            autoComplete="new-password"
          />

          {/* اختيار العملة */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="currency">
            {t('register.currency.label')}
          </label>
          <div className="relative overflow-visible">
            <ResponsiveCurrencySelect
              options={currencies}
              value={currencyId}
              onChange={setCurrencyId}
              placeholder={t('register.currency.placeholder')}
            />
          </div>

          {/* زر التسجيل */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-800 text-white py-2 rounded hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? t('register.submitting') : t('register.submit')}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            {t('register.haveAccount')}{' '}
            <a href="/login" className="text-sky-600 hover:underline">
              {t('register.loginLink')}
            </a>
          </p>
        </form>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
