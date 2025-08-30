'use client';
import { useEffect, useRef, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { usePasskeys } from '@/hooks/usePasskeys';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';

interface PasskeyItem { id: string; credentialId: string; label?: string | null; lastUsedAt?: string | null; createdAt: string; }

export default function PasskeysPage() {
  const { user } = useUser();
  const router = useRouter();
  const { registerPasskey, loading: opLoading } = usePasskeys();
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<PasskeyItem[]>(API_ROUTES.auth.passkeys.list, { validateStatus: () => true });
      if (res.status === 200) setItems(res.data); else throw new Error('تعذر الجلب');
    } catch (e: any) { show(e?.message || 'خطأ'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!user) { router.push('/login'); return; } load(); }, [user]);

  // إذا وُجد ?add=1 ركز الحقل وضع قيمة افتراضية
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
      setLabel(l => l || 'جهازي');
      setTimeout(()=>{ inputRef.current?.focus(); }, 50);
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">مفاتيح المرور (Passkeys)</h1>
      <p className="text-sm text-gray-600 mb-6">أدر مفاتيح المرور المرتبطة بحسابك. يمكنك إنشاء مفتاح جديد لكل جهاز تستخدمه.</p>

      <div className="mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">تسمية الجهاز</label>
          <input ref={inputRef} value={label} onChange={e=>setLabel(e.target.value)} placeholder="مثال: لابتوب العمل" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <button
          disabled={opLoading}
          onClick={async ()=>{ try { await registerPasskey(label || 'جهازي'); setLabel(''); show('تم الإنشاء'); await load(); } catch (e:any) { show(e?.message || 'فشل'); } }}
          className="bg-sky-600 text-white text-sm px-4 py-2 rounded hover:brightness-110 disabled:opacity-60"
        >{opLoading? '...' : 'إنشاء مفتاح'}</button>
      </div>

      {loading && <div>جاري التحميل...</div>}

      {!loading && items.length === 0 && <div className="text-sm text-gray-500">لا توجد مفاتيح بعد.</div>}

      <ul className="space-y-3">
        {items.map(i => (
          <li key={i.id} className="border rounded p-3 flex justify-between items-center bg-white dark:bg-gray-800">
            <div>
              <div className="font-medium text-sm">{i.label || 'بدون اسم'} <span className="text-gray-400 text-xs">({i.credentialId.slice(0,8)}…)</span></div>
              <div className="text-xs text-gray-500">أُنشئ: {new Date(i.createdAt).toLocaleString()} {i.lastUsedAt && <>• آخر استخدام: {new Date(i.lastUsedAt).toLocaleString()}</>}</div>
            </div>
            <button
              onClick={async ()=>{
                // حماية: منع حذف آخر مفتاح مرور
                if (items.length === 1) {
                  alert('لا يمكنك حذف مفتاح المرور الوحيد. أضف مفتاحاً جديداً أولاً للمحافظة على وسيلة دخول آمنة.');
                  return;
                }
                if(!confirm('حذف هذا المفتاح؟')) return;
                try {
                  await api.delete(API_ROUTES.auth.passkeys.delete(i.credentialId));
                  show('تم الحذف');
                  await load();
                } catch (e:any) { show(e?.message || 'فشل'); }
              }}
              className="text-xs text-red-600 hover:underline"
            >حذف</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
