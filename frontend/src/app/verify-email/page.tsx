'use client';
import { useState } from 'react';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useToast } from '@/context/ToastContext';

export default function VerifyEmailPage() {
  const { request, verify, requested, verified, loading, error } = useEmailVerification();
  const [token, setToken] = useState('');
  const { show } = useToast();

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">التحقق من البريد</h1>
      <p className="text-sm text-gray-600 mb-4">اطلب رسالة التحقق ثم ألصق الرمز (token) هنا بعد استلامه (مؤقتًا يظهر في سجل الخادم).</p>
      <button disabled={loading || requested} onClick={async ()=>{ try { await request(); show('تم إرسال الطلب'); } catch(e:any){ show(e.message || 'فشل'); } }} className="bg-sky-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">{requested? 'تم الإرسال' : 'طلب التحقق'}</button>
      <div className="mt-6">
        <label className="block text-sm mb-1">رمز التحقق</label>
        <input value={token} onChange={e=>setToken(e.target.value)} className="border w-full rounded px-3 py-2 text-sm" />
        <button disabled={loading || !token || verified} onClick={async ()=>{ try { await verify(token); show('تم التحقق'); } catch(e:any){ show(e.message || 'فشل'); } }} className="mt-3 bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">تحقق</button>
      </div>
      {verified && <div className="mt-4 text-green-700 text-sm">تم التحقق من البريد ✅</div>}
      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
    </div>
  );
}
