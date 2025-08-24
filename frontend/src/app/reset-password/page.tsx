'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useToast } from '@/context/ToastContext';

function ResetPasswordInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token') || '';
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw1 !== pw2) { show('كلمتا المرور غير متطابقتين'); return; }
    setLoading(true);
    try {
      await api.post(API_ROUTES.auth.resetPassword, { token, newPassword: pw1 });
      show('تم تغيير كلمة المرور');
      setDone(true);
      localStorage.removeItem('token');
      document.cookie = 'access_token=; Max-Age=0; path=/';
      setTimeout(()=> router.push('/login'), 2000);
    } catch (e:any) { show(e?.message || 'فشل'); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded shadow p-6">
      <h1 className="text-xl font-semibold mb-4">إعادة تعيين كلمة المرور</h1>
      {done ? (
        <p className="text-sm text-gray-600">تم التغيير، سيتم توجيهك لصفحة الدخول.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">كلمة المرور الجديدة</label>
            <input type="password" required minLength={6} value={pw1} onChange={e=>setPw1(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">تأكيد كلمة المرور</label>
            <input type="password" required minLength={6} value={pw2} onChange={e=>setPw2(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
            <button disabled={loading} className="w-full bg-sky-600 text-white rounded py-2 disabled:opacity-60">{loading? '...' : 'تعيين كلمة المرور'}</button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center text-sm text-gray-500">...</div>}>
        <ResetPasswordInner />
      </Suspense>
    </div>
  );
}
