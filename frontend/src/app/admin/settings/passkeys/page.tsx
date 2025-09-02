'use client';
import { useEffect, useState, useRef } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { usePasskeys } from '@/hooks/usePasskeys';
import { useToast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';

interface PasskeyItem { id: string; name: string; createdAt: string; lastUsedAt?: string | null }

export default function AdminSettingsPasskeysPage() {
  const { user } = useUser();
  const router = useRouter();
  const { registerPasskey, loading: opLoading } = usePasskeys();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [errorShown, setErrorShown] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<PasskeyItem[]>(API_ROUTES.auth.passkeys.list, { validateStatus: () => true });
      if (res.status === 200) setItems(res.data); else if (res.status === 401) { if(!errorShown){ show('يرجى تسجيل الدخول'); setErrorShown(true);} router.push('/login'); }
    } catch (e:any) { if(!errorShown){ show(e?.message || 'خطأ'); setErrorShown(true);} }
    finally { setLoading(false); }
  };

  useEffect(()=>{ if(!user){ router.push('/login'); return;} load(); },[user]);

  return (
    <div className="admin-container py-4 max-w-3xl">
      <h1 className="text-xl font-bold mb-4">مفاتيح المرور (الأمان)</h1>
      <p className="text-sm text-text-secondary mb-6">أدر مفاتيح المرور المرتبطة بحساب المالك. استخدم مفاتيح متعددة لأجهزة مختلفة.</p>
      <div className="mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">تسمية الجهاز</label>
          <input ref={inputRef} value={label} onChange={e=>setLabel(e.target.value)} placeholder="مثال: لابتوب المكتب" className="w-full border border-border rounded px-3 py-2 text-sm bg-bg-surface" />
        </div>
        <button
          disabled={opLoading}
          onClick={async ()=>{ try { await registerPasskey(label || 'جهازي'); setLabel(''); show('تم الإنشاء'); await load(); } catch (e:any) { show(e?.message || 'فشل'); } }}
          className="bg-primary text-white text-sm px-4 py-2 rounded hover:brightness-110 disabled:opacity-60"
        >{opLoading? '...' : 'إنشاء مفتاح'}</button>
      </div>
      {loading && <div>جاري التحميل...</div>}
      {!loading && items.length === 0 && <div className="text-sm text-text-secondary">لا توجد مفاتيح.</div>}
      <table className="w-full text-sm border border-border rounded overflow-hidden">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2 text-right">الاسم</th>
            <th className="p-2 text-right">تاريخ الإنشاء</th>
            <th className="p-2 text-right">آخر استخدام</th>
            <th className="p-2 text-right">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map(pk => (
            <tr key={pk.id} className="border-t border-border">
              <td className="p-2">{pk.name || 'Passkey'} <span className="text-xs text-text-secondary">#{pk.id.slice(0,8)}</span></td>
              <td className="p-2">{new Date(pk.createdAt).toLocaleString()}</td>
              <td className="p-2">{pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString() : '—'}</td>
              <td className="p-2">
                <button
                  disabled={items.length === 1}
                  onClick={async ()=>{
                    if(items.length === 1){ show('لا يمكن حذف آخر مفتاح'); return; }
                    if(!confirm('حذف هذا المفتاح؟')) return;
                    try { await api.delete(API_ROUTES.auth.passkeys.delete(pk.id)); show('تم الحذف'); await load(); } catch(e:any){ show(e?.message || 'فشل'); }
                  }}
                  className="text-red-600 hover:underline disabled:opacity-40"
                >حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
