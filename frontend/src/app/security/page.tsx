'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

interface StatusResp { enabled: boolean }

export default function SecurityPage(){
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function load(){
    setLoading(true);
    try {
      const { data } = await api.get<StatusResp>('/auth/totp/status');
      setEnabled(!!data.enabled);
    } catch (e:any){
      show(e?.response?.data?.message || 'فشل جلب الحالة');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  async function startSetup(){
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const inAdmin = currentPath.startsWith('/admin');
    const nextTarget = inAdmin ? '/admin/settings/security' : '/user';
    const setupPath = inAdmin ? '/admin/totp-setup' : '/user/totp-setup';
    window.location.href = `${setupPath}?next=${encodeURIComponent(nextTarget)}`;
  }

  async function disableTotp(){
    if(!confirm('هل تريد تعطيل المصادقة الثنائية؟')) return;
    setDisabling(true);
    try { await api.post('/auth/totp/disable'); show('تم التعطيل'); setEnabled(false); setCodes(null); }
    catch(e:any){ show(e?.response?.data?.message || 'فشل التعطيل'); }
    finally { setDisabling(false); }
  }

  async function regenerateCodes(){
    setRegenLoading(true);
    try { const { data } = await api.post('/auth/totp/recovery-codes/regenerate'); setCodes(data.codes||[]); show('تم إنشاء رموز جديدة'); }
    catch(e:any){ show(e?.response?.data?.message || 'فشل إنشاء الرموز'); }
    finally { setRegenLoading(false); }
  }

  return (
    <div className="min-h-screen p-4 max-w-xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">الأمان</h1>
      {loading ? <div>تحميل...</div> : (
        <div className="space-y-6">
          {!enabled && (
            <div className="p-4 rounded border bg-bg-surface text-text-primary">
              <h2 className="font-semibold mb-2">تفعيل المصادقة الثنائية (TOTP)</h2>
              <p className="text-sm text-text-secondary mb-4">ننصح بتفعيل المصادقة الثنائية لحماية حسابك.</p>
              <button onClick={startSetup} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover">ابدأ التفعيل</button>
            </div>
          )}

          {enabled && (
            <div className="p-4 rounded border bg-bg-surface text-text-primary space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">المصادقة الثنائية مفعّلة ✅</h2>
                  <p className="text-sm text-text-secondary">يمكنك استخدام الرموز من تطبيق المصادقة أو الرموز الاحتياطية.</p>
                </div>
                <button disabled={disabling} onClick={disableTotp} className="text-sm px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">تعطيل</button>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">الرموز الاحتياطية</h3>
                <p className="text-xs text-text-secondary mb-3">استخدمها إذا فقدت الوصول لتطبيق المصادقة. كل رمز يستخدم مرة واحدة.</p>
                {codes ? (
                  <div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm mb-3">
                      {codes.map(c => <div key={c} className="px-2 py-1 rounded border bg-bg-surface-alt text-center">{c}</div>)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>{ navigator.clipboard.writeText(codes.join('\n')); show('تم النسخ'); }} className="px-3 py-2 rounded bg-bg-surface-alt hover:bg-bg-surface-alt/80 text-sm">نسخ</button>
                      <button onClick={()=> setCodes(null)} className="px-3 py-2 rounded bg-bg-surface-alt hover:bg-bg-surface-alt/80 text-sm">إخفاء</button>
                    </div>
                  </div>
                ) : (
                  <button disabled={regenLoading} onClick={regenerateCodes} className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50">{regenLoading? 'جاري الإنشاء...' : 'إنشاء / إعادة توليد الرموز'}</button>
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-text-secondary">
            <Link href="/user" className="text-link">رجوع إلى الحساب</Link>
          </div>
        </div>
      )}
    </div>
  );
}
