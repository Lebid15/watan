"use client";
export const dynamic='force-dynamic';
export const fetchCache='force-no-store';
import { useEffect, useState } from 'react';
import api, { API_BASE_URL, Api } from '@/utils/api';

type Tenant = { id:string; name:string; code:string; isActive:boolean; createdAt:string; ownerUserId?:string|null };
type Domain = { id:string; domain:string; type:'subdomain'|'custom'; isPrimary:boolean; isVerified:boolean };
type CreateTenantResp = { tenant:Tenant; defaultDomain?:string; ownerEmail?:string|null; ownerTempPassword?:string|undefined };
export default function SubdomainsPageClient(){
  const [items,setItems]=useState<Tenant[]>([]); const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [creating,setCreating]=useState(false); const [form,setForm]=useState({ name:'', code:'', ownerEmail:'', ownerName:'' });
  const [lastCreated,setLastCreated]=useState<{ email?:string; password?:string; domain?:string; name?:string }|null>(null);
  const [lastReset,setLastReset]=useState<{ tenantId:string; email?:string; password?:string }|null>(null);
  const [domains,setDomains]=useState<Record<string,Domain[]>>({});
  const [newDomain,setNewDomain]=useState<{ tenantId:string; type:'subdomain'|'custom'; domain:string }|null>(null);
  const refresh=async()=>{
    setLoading(true);
    try {
      const { data } = await api.get<any>(`${API_BASE_URL}/admin/tenants`);
      const payload = (data && typeof data==='object' && !Array.isArray(data) && data.data) ? data.data : data;
      const items: Tenant[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
      setItems(items);
    } finally { setLoading(false);} };
  const loadDomains=async(tenantId:string)=>{ const { data }=await api.get<Domain[]>(`${API_BASE_URL}/admin/tenants/${tenantId}/domains`); setDomains(m=>({...m,[tenantId]:data})); };
  useEffect(()=>{
    (async()=>{
      try {
        const me = await Api.me();
        const r = String((me?.data?.role || me?.data?.user?.role || '')).toLowerCase();
        // RBAC: developer actions allowed only for admin | instance_owner
        setAllowed(r==='admin' || r==='instance_owner');
      } catch { setAllowed(false); }
      await refresh();
    })();
  },[]);
  async function createTenant(){ if(!form.name || !form.code) return alert('أدخل الاسم والكود'); setCreating(true); try { const payload={ name:form.name.trim(), code:form.code.trim().toLowerCase(), ownerEmail: form.ownerEmail.trim()||undefined, ownerName: form.ownerName.trim()||undefined }; const { data }=await api.post<CreateTenantResp>(`${API_BASE_URL}/admin/tenants`, payload); setForm({ name:'', code:'', ownerEmail:'', ownerName:'' }); setLastCreated({ email:data.ownerEmail||undefined, password:data.ownerTempPassword, domain:data.defaultDomain, name:data.tenant?.name }); await refresh(); } catch(e:any){ alert(e?.response?.data?.message || 'فشل الإنشاء'); } finally { setCreating(false);} }
  async function addDomain(){ if(!newDomain) return; if(!newDomain.domain.trim()) return alert('أدخل اسم النطاق'); try { await api.post(`${API_BASE_URL}/admin/tenants/${newDomain.tenantId}/domains`, { domain:newDomain.domain.trim(), type:newDomain.type, isPrimary:true }); const id=newDomain.tenantId; setNewDomain(null); await loadDomains(id); } catch(e:any){ alert(e?.response?.data?.message || 'فشل إضافة النطاق'); } }
  async function setPrimary(tenantId:string, domainId:string){ await api.patch(`${API_BASE_URL}/admin/tenants/${tenantId}/domains/${domainId}`, { isPrimary:true }); await loadDomains(tenantId); }
  function asUrl(domain:string){ const hasScheme=/^https?:\/\//i.test(domain); if(hasScheme) return domain; if(typeof window!=='undefined'){ const { protocol, port }=window.location; const portPart=port? `:${port}`:''; return `${protocol}//${domain}${portPart}`; } return `http://${domain}`; }
  async function resetOwnerPassword(tenantId:string){ try { const { data }=await api.post<{ ownerEmail?:string; ownerTempPassword?:string }>(`${API_BASE_URL}/admin/tenants/${tenantId}/reset-owner-password`, {}); if(!data?.ownerTempPassword){ alert('لم تُسترجع كلمة المرور (تحقق من الخادم)'); return; } setLastReset({ tenantId, email:data.ownerEmail, password:data.ownerTempPassword }); } catch(e:any){ alert(e?.response?.data?.message || 'فشل إعادة تعيين كلمة المرور'); } }
  return <div className="p-4 space-y-6"> <h1 className="text-2xl font-bold">Subdomains / المتاجر</h1>
    <div className="text-xs text-gray-600">لإدارة المتجر (تعديل/حذف)، استخدم صفحة الإدارة: <a className="text-blue-600 underline" href="/admin/tenants">/admin/tenants</a></div>
    <div className="bg-white rounded-xl p-4 shadow"><h2 className="font-semibold mb-3">إنشاء متجر جديد</h2><div className="flex flex-col sm:flex-row gap-3"><input className="border rounded p-2 w-full" placeholder="اسم المتجر" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input className="border rounded p-2 w-full" placeholder="الكود (للـ subdomain)" value={form.code} onChange={e=> setForm({...form, code:e.target.value.toLowerCase()})}/></div><div className="flex flex-col sm:flex-row gap-3 mt-3"><input className="border rounded p-2 w-full" placeholder="بريد مالك المتجر (Admin)" value={form.ownerEmail} onChange={e=> setForm({...form, ownerEmail:e.target.value})}/><input className="border rounded p-2 w-full" placeholder="اسم المالك (اختياري)" value={form.ownerName} onChange={e=> setForm({...form, ownerName:e.target.value})}/><button className="bg-black text-white rounded px-4" onClick={createTenant} disabled={creating}>{creating? '...':'إنشاء'}</button></div>{lastCreated && <div className="mt-3 text-sm bg-green-50 border border-green-200 rounded p-3"><div>تم الإنشاء ✅</div>{lastCreated.name && <div>المتجر: <b>{lastCreated.name}</b></div>}{lastCreated.domain && <div>النطاق الافتراضي: <a className="text-blue-600 underline" href={asUrl(lastCreated.domain)} target="_blank" rel="noreferrer">{lastCreated.domain}</a></div>}{lastCreated.email && <div>مشرف المتجر: <b>{lastCreated.email}</b></div>}{lastCreated.password && <div>كلمة السر المؤقتة (Dev فقط) <code className="px-1.5 py-0.5 rounded bg-white border">{lastCreated.password}</code></div>}</div>}</div>
    <div className="bg-white rounded-xl p-4 shadow"><h2 className="font-semibold mb-3">كل المتاجر</h2>{loading? <div>Loading...</div>: <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]"><thead><tr className="text-right border-b"><th className="py-2">الاسم</th><th>الكود</th><th>النطاقات</th><th>إضافة نطاق</th><th>إدارة</th></tr></thead><tbody>{items.map(t=> <tr key={t.id} className="border-b align-top"><td className="py-2">{t.name}</td><td>{t.code}</td><td><div className="flex items-center gap-2"><button className="underline" onClick={()=>loadDomains(t.id)}>تحديث</button><span className="text-xs text-gray-500">({(domains[t.id]||[]).length})</span></div><ul className="mt-2 space-y-1">{(domains[t.id]||[]).map(d=> <li key={d.id} className="flex items-center gap-2"><a className="text-blue-600 underline" href={asUrl(d.domain)} target="_blank" rel="noreferrer" title={d.type==='custom'? 'Custom Domain':'Subdomain'}>{d.domain}</a>{d.isPrimary && <span className="text-xs px-2 py-0.5 bg-green-100 rounded">Primary</span>}{!d.isPrimary && <button className="text-xs underline" onClick={()=>setPrimary(t.id,d.id)}>اجعله أساسيًا</button>}{!d.isVerified && <span className="text-xs px-2 py-0.5 bg-yellow-100 rounded">غير مُتحقق</span>}</li>)}</ul></td><td>{newDomain?.tenantId===t.id? <div className="flex flex-col sm:flex-row gap-2"><select className="border rounded p-2" value={newDomain.type} onChange={e=> setNewDomain({...newDomain!, type:e.target.value as any})}><option value="subdomain">Subdomain</option><option value="custom">Custom</option></select><input className="border rounded p-2" placeholder="domain أو sub.example.com" value={newDomain.domain} onChange={e=> setNewDomain({...newDomain!, domain:e.target.value})}/><button className="bg-black text-white rounded px-3" onClick={addDomain}>إضافة</button><button className="rounded px-3 border" onClick={()=> setNewDomain(null)}>إلغاء</button></div>: <button className="rounded px-3 border" onClick={()=> setNewDomain({ tenantId:t.id, type:'subdomain', domain:'' })}>+ نطاق</button>}</td><td><div className="flex flex-col gap-2">
            {allowed ? (
              <a className="rounded px-3 py-1 border text-xs text-center hover:bg-gray-50" href={`/admin/tenants?q=${encodeURIComponent(t.code)}`} title="إدارة هذا المتجر في لوحة الإدارة">إدارة</a>
            ) : (
              <span className="text-[11px] text-gray-400">Access denied</span>
            )}
            <button className="rounded px-3 py-1 border text-xs" onClick={()=>resetOwnerPassword(t.id)} title="إعادة تعيين كلمة مرور مالك المتجر">إعادة تعيين باسورد المالك</button>{lastReset?.tenantId===t.id && lastReset.password && <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2 flex flex-col gap-1"><div><span className="font-semibold">تمت إعادة التعيين ✅ كلمة المرور المؤقتة:</span><code className="ml-2 px-1.5 py-0.5 bg-white border rounded">{lastReset.password}</code><button className="ml-2 text-blue-600 underline" onClick={()=> navigator.clipboard.writeText(lastReset.password || '')}>نسخ</button></div>{lastReset.email && <div>بريد المالك: <b>{lastReset.email}</b></div>}<div className="text-[10px] text-gray-500">لا تُعرض هذه الرسالة إلا لك (Developer) – انسخها الآن.</div></div>}
          </div></td></tr>)}{items.length===0 && <tr><td className="py-6 text-center" colSpan={5}>لا توجد متاجر بعد</td></tr>}</tbody></table></div>}</div></div>;
}
