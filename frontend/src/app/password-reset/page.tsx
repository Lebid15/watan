'use client';
import { useState } from 'react';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/context/ToastContext';

export default function PasswordResetPage() {
  const { request, reset, requested, completed, loading, error } = usePasswordReset();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { show } = useToast();

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">إعادة تعيين كلمة المرور</h1>
      <div className="mb-6">
        <label className="block text-sm mb-1">البريد أو اسم المستخدم</label>
  <input value={email} onChange={e=>setEmail(e.target.value)} className="border w-full rounded px-3 py-2 text-sm text-black placeholder-gray-400" placeholder="example@mail.com" />
        <button disabled={loading || !email || requested} onClick={async ()=>{ try { await request(email); show('تم إرسال الطلب (تحقق من السجل مؤقتاً)'); } catch(e:any){ show(e.message || 'فشل'); } }} className="mt-3 bg-sky-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">{requested? 'تم الإرسال' : 'طلب رابط إعادة التعيين'}</button>
      </div>
      <div>
        <label className="block text-sm mb-1">رمز إعادة التعيين</label>
  <input value={token} onChange={e=>setToken(e.target.value)} className="border w-full rounded px-3 py-2 text-sm text-black placeholder-gray-400" />
        <label className="block text-sm mb-1 mt-4">كلمة مرور جديدة</label>
  <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="border w-full rounded px-3 py-2 text-sm text-black placeholder-gray-400" />
        <button disabled={loading || !token || !newPassword || completed} onClick={async ()=>{ try { await reset(token, newPassword); show('تم التغيير'); } catch(e:any){ show(e.message || 'فشل'); } }} className="mt-3 bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60">تعيين كلمة مرور</button>
      </div>
      {completed && <div className="mt-4 text-green-700 text-sm">تم تعيين كلمة المرور ✅</div>}
      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
    </div>
  );
}
