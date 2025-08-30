'use client';

import { useState, useEffect } from 'react';
import ResponsiveCurrencySelect from '@/components/ResponsiveCurrencySelect';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';

interface Currency {
  id: string;
  name: string;
  code: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [currencyId, setCurrencyId] = useState(''); // ابقيه فاضي حتى يختار المستخدم
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // جلب العملات من الباك إند
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const res = await api.get<Currency[]>(API_ROUTES.currencies.base);
        setCurrencies(res.data);

        // اختيار الليرة السورية افتراضيًا إذا موجودة، وإلا ابقِه فاضي
        const syp = res.data.find((c) => c.code === 'SYP');
        if (syp) setCurrencyId(syp.id);
      } catch (err) {
        console.error('فشل في جلب العملات', err);
      }
    };
    fetchCurrencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currencyId) {
      setError('يرجى اختيار العملة');
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
      alert('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.');
      router.push('/login');
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'فشل التسجيل. قد يكون البريد مستخدمًا مسبقًا.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center">
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
            إنشاء حساب جديد
          </h2>

          {error && <div className="mb-4 text-red-600 text-center">{error}</div>}

          {/* الاسم الكامل */}
          <label className="block mb-1 font-medium text-gray-800" htmlFor="fullName">
            الاسم الكامل
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
            اسم المستخدم
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
            البريد الإلكتروني
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
            كلمة المرور
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
            اختر العملة
          </label>
          <div className="relative overflow-visible">
            <ResponsiveCurrencySelect
              options={currencies}
              value={currencyId}
              onChange={setCurrencyId}
              placeholder="اختر العملة"
            />
          </div>

          {/* زر التسجيل */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-800 text-white py-2 rounded hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? 'جاري التسجيل...' : 'تسجيل'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            لديك حساب؟{' '}
            <a href="/login" className="text-sky-600 hover:underline">
              تسجيل الدخول
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
