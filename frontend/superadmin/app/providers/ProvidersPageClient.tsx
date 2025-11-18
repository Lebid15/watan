"use client";
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { useEffect, useState } from 'react';
import api from '@/utils/api';

// ... (moved types and logic from previous page)

type ProviderKind = 'barakat' | 'apstore' | 'znet';

type Provider = {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl?: string | null;
};

type EnableProviderResp = {
  ok: boolean;
  providerId: string;
  productsTouched: number;
  createdPackages: number;
  skippedPackages: number;
  totalCatalogPackages: number;
};

function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
    return (data as any).items as T[];
  }
  return [];
}

export default function ProvidersPageClient(){
  const [items, setItems] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [jobMap, setJobMap] = useState<Record<string, { status: string; message?: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    provider: ProviderKind;
    baseUrl: string;
    apiToken: string;
    kod: string;
    sifre: string;
  }>({ name: '', provider: 'barakat', baseUrl: '', apiToken: '', kod: '', sifre: '' });

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || token.length < 20) { setTimeout(() => load(), 150); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.get('/admin/providers/dev', { headers });
      const list: Provider[] = extractItems<Provider>(res.data);
      setItems(list);
    } catch (e:any) {
      setError(e?.response?.data?.message || e.message || 'فشل الجلب');
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  function openCreate(){ setIsEdit(false); setEditId(null); setForm({ name: '', provider: 'barakat', baseUrl: '', apiToken: '', kod: '', sifre: '' }); setOpenModal(true);}  
  function openEdit(p: Provider){ setIsEdit(true); setEditId(p.id); setForm({ name: p.name ?? '', provider: p.provider, baseUrl: p.baseUrl ?? '', apiToken: '', kod: '', sifre: '' }); setOpenModal(true);}  

  async function submitCreate(){
    setError(''); setNotice('');
    try {
      const payload:any = { name: form.name.trim(), provider: form.provider, baseUrl: form.baseUrl.trim() || undefined };
      if (form.provider==='barakat' || form.provider==='apstore') payload.apiToken = form.apiToken.trim() || undefined; else if(form.provider==='znet'){ payload.kod=form.kod.trim()||undefined; payload.sifre=form.sifre.trim()||undefined; }
      await api.post('/admin/providers/dev', payload); setNotice('✅ تم إضافة المزوّد'); setOpenModal(false); await load();
    }catch(e:any){ setError(`⚠️ فشل الإضافة: ${e?.response?.data?.message || e.message}`);} }

  async function submitEdit(){ if(!editId) return; setError(''); setNotice('');
    try { const payload:any={ name: form.name.trim()||undefined, baseUrl: form.baseUrl.trim()||undefined };
      if(form.provider==='barakat' || form.provider==='apstore'){ if(form.apiToken.trim()) payload.apiToken=form.apiToken.trim(); }
      else if(form.provider==='znet'){ if(form.kod.trim()) payload.kod=form.kod.trim(); if(form.sifre.trim()) payload.sifre=form.sifre.trim(); }
      await api.patch(`/admin/providers/dev/${editId}`, payload); setNotice('✅ تم تحديث المزوّد'); setOpenModal(false); await load();
    }catch(e:any){ setError(`⚠️ فشل التعديل: ${e?.response?.data?.message || e.message}`);} }

  async function handleDelete(id:string){ if(!confirm('هل تريد حذف هذا المزوّد؟')) return; setDeletingId(id); setError(''); setNotice('');
    try { await api.delete(`/admin/providers/dev/${id}`); setNotice('🗑️ تم الحذف'); setItems(prev=>prev.filter(x=>x.id!==id)); }
    catch(e:any){ setError(`⚠️ فشل الحذف: ${e?.response?.data?.message || e.message}`);} finally { setDeletingId(null);} }

  async function handleImport(providerId:string){ setBusyId(providerId); setError(''); setNotice(''); setJobMap(m=>({...m,[providerId]:{status:'starting'}}));
    try { const startRes = await api.post<{ ok:boolean; jobId:string }>(`/admin/providers/${providerId}/catalog-import/async`); const jobId = startRes.data.jobId; setJobMap(m=>({...m,[providerId]:{status:'running', message:'جاري الاستيراد...'}}));
      const startedAt=Date.now(); const poll=async():Promise<void>=>{ try { const { data } = await api.get<{ ok:boolean; job:any }>(`/admin/providers/import-jobs/${jobId}`); const job=data.job; if(!job){ setJobMap(m=>({...m,[providerId]:{status:'error',message:'لم يُعثر على المهمة'}})); setBusyId(null); return; } if(job.status==='running'){ if(Date.now()-startedAt>10*60*1000){ setJobMap(m=>({...m,[providerId]:{status:'error',message:'انتهت مهلة الاستيراد'}})); setBusyId(null); return;} setTimeout(poll,2000);} else if(job.status==='done'){ const res=job.result?.result || job.result; const createdP=res?.createdProducts??0; const createdPk=res?.createdPackages??0; const updP=res?.updatedProducts??0; const updPk=res?.updatedPackages??0; const total=res?.total ?? res?.processedProducts ?? 0; setNotice(`اكتمل الاستيراد: منتجات جديدة ${createdP}, محدثة ${updP}, باقات جديدة ${createdPk}, محدثة ${updPk}, إجمالي عناصر ${total}`); setJobMap(m=>({...m,[providerId]:{status:'done'}})); setBusyId(null);} else if(job.status==='error'){ setError(`فشل الاستيراد: ${job.error || 'خطأ غير معروف'}`); setJobMap(m=>({...m,[providerId]:{status:'error',message:job.error}})); setBusyId(null);} else { setJobMap(m=>({...m,[providerId]:{status:job.status || 'unknown'}})); setTimeout(poll,2000);} } catch(e:any){ setJobMap(m=>({...m,[providerId]:{status:'error',message:e?.response?.data?.message || e.message}})); setError(`فشل الاستيراد: ${e?.response?.data?.message || e.message}`); setBusyId(null);} }; setTimeout(poll,1500);
    }catch(e:any){ setError(`فشل بدء الاستيراد: ${e?.response?.data?.message || e.message}`); setBusyId(null); setJobMap(m=>({...m,[providerId]:{status:'error',message:e?.message}})); } }

  async function handleEnableAllForProvider(providerId:string){ setBusyId(providerId); setError(''); setNotice(''); try { const { data } = await api.post<EnableProviderResp>(`/admin/catalog/providers/${providerId}/enable-all`); setNotice(`✅ تفعيل: منتجات ${data.productsTouched} / باقات جديدة ${data.createdPackages} / متجاهلة ${data.skippedPackages}`);} catch(e:any){ setError(`⚠️ فشل التفعيل: ${e?.response?.data?.message || e.message}`);} finally { setBusyId(null);} }

  const isBarakatOrAp = form.provider==='barakat' || form.provider==='apstore';
  const isZnet = form.provider==='znet';
  const canSaveCreate = form.name.trim().length>1 && (isBarakatOrAp? form.apiToken.trim().length>0:true) && (isZnet? form.kod.trim().length>0 && form.sifre.trim().length>0:true);
  const canSaveEdit = form.name.trim().length>0;

  return (<div className="space-y-4">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">المزوّدون</h1>
      <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:opacity-90">➕ إضافة مزوّد</button>
    </div>
    {notice && (<div className="mb-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800 shadow">✅ {notice}</div>)}
    {error && (<div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 shadow">⚠️ {error}</div>)}
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="min-w-full text-sm "><thead className="bg-zinc-200"><tr><th className="border px-3 py-2">الاسم</th><th className="border px-3 py-2">النوع</th><th className="border px-3 py-2">Base URL</th><th className="border px-3 py-2">عمليات الكتالوج</th></tr></thead><tbody>
        {items.map(p=> (<tr key={p.id} className="border-t"><td className="border px-3 py-2 font-semibold">{p.name}</td><td className="border px-3 py-2 uppercase">{p.provider}</td><td className="border px-3 py-2 text-xs text-zinc-600">{p.baseUrl ?? '-'}</td><td className="border px-3 py-2"><div className="flex items-center gap-2">
          <button onClick={()=>handleImport(p.id)} disabled={busyId===p.id} className={`px-3 py-1.5 rounded-lg text-white ${busyId===p.id ? 'bg-zinc-400':'bg-gray-700 hover:opacity-90'}`}>{busyId===p.id ? (jobMap[p.id]?.status==='running' ? 'جارٍ...':'...'):'استيراد/تحديث'}</button>
          <button onClick={()=>handleEnableAllForProvider(p.id)} disabled={busyId===p.id} className={`px-3 py-1.5 rounded-lg border bg-green-500 ${busyId===p.id ? 'bg-zinc-100 text-zinc-400':'hover:bg-green-300'}`}>{busyId===p.id ? '...':'تفعيل الكتالوج للمتجر'}</button>
          <button onClick={()=>openEdit(p)} className="px-3 py-1.5 rounded-lg border bg-orange-400 hover:bg-orange-300">تعديل</button>
          <button onClick={()=>handleDelete(p.id)} disabled={deletingId===p.id} className={`px-3 py-1.5 rounded-lg border bg-red-700 text-white ${deletingId===p.id ? 'bg-gray-100 text-red-700':'hover:bg-red-600'}`}>{deletingId===p.id ? 'يحذف...':'حذف'}</button>
        </div></td></tr>))}
        {items.length===0 && !loading && (<tr><td className="px-3 py-4 text-zinc-500" colSpan={4}>لا توجد بيانات</td></tr>)}
      </tbody></table>
    </div>
    {loading && <div className="text-sm text-zinc-600">جارٍ التحميل…</div>}
    {openModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg"><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">{isEdit ? 'تعديل مزوّد':'إضافة مزوّد جديد'}</h2><button onClick={()=>setOpenModal(false)} className="text-zinc-500 hover:text-zinc-800">✕</button></div>
      <div className="space-y-3">
        <div><label className="block text-sm mb-1">الاسم</label><input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="الاسم التعريفي لديك" className="w-full border rounded-lg px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">الجهة</label><select value={form.provider} onChange={e=>setForm({...form, provider:e.target.value as ProviderKind})} className="w-full border rounded-lg px-3 py-2" disabled={isEdit}><option value="barakat">barakat</option><option value="apstore">apstore</option><option value="znet">znet</option></select></div>
        <div><label className="block text-sm mb-1">Base URL (اختياري)</label><input value={form.baseUrl} onChange={e=>setForm({...form, baseUrl:e.target.value})} placeholder={form.provider==='znet' ? 'http://bayi.siteadressinstead.com':'https://api.x-stor.net'} className="w-full border rounded-lg px-3 py-2" /></div>
        {(form.provider==='barakat' || form.provider==='apstore') && (<div><label className="block text-sm mb-1">API Token {isEdit && <span className="text-xs text-zinc-500">(اتركه فارغًا إن لم ترغب بتغييره)</span>}</label><input value={form.apiToken} onChange={e=>setForm({...form, apiToken:e.target.value})} placeholder="ادخل التوكن" className="w-full border rounded-lg px-3 py-2" /></div>)}
        {form.provider==='znet' && (<><div><label className="block text-sm mb-1">رقم الجوال {isEdit && <span className="text-xs text-zinc-500">(اتركه فارغًا إن لم ترغب بتغييره)</span>}</label><input value={form.kod} onChange={e=>setForm({...form, kod:e.target.value})} placeholder="54421999998" className="w-full border rounded-lg px-3 py-2" /></div><div><label className="block text-sm mb-1">كلمة السر {isEdit && <span className="text-xs text-zinc-500">(اتركها فارغة إن لم ترغب بتغييرها)</span>}</label><input value={form.sifre} onChange={e=>setForm({...form, sifre:e.target.value})} placeholder="*******" className="w-full border rounded-lg px-3 py-2" /></div></>)}
      </div>
      <div className="flex items-center justify-end gap-2 pt-4"><button onClick={()=>setOpenModal(false)} className="px-3 py-1.5 border rounded-lg">إلغاء</button>{!isEdit ? (<button onClick={submitCreate} disabled={!canSaveCreate} className={`px-3 py-1.5 rounded-lg text-white ${canSaveCreate ? 'bg-emerald-600 hover:opacity-90':'bg-zinc-400 cursor-not-allowed'}`}>حفظ</button>):(<button onClick={submitEdit} disabled={!canSaveEdit} className={`px-3 py-1.5 rounded-lg text-white ${canSaveEdit ? 'bg-black hover:opacity-90':'bg-zinc-400 cursor-not-allowed'}`}>تحديث</button>)}
      </div>
      {!isEdit && (<div className="text-xs text-zinc-500 pt-2">ملاحظة: لـ <b>barakat/apstore</b> يلزم API Token، ولـ <b>znet</b> يلزم <code>kod</code> و<code>sifre</code>.</div>)}
    </div></div>)}
  </div>);
}
