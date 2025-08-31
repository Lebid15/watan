"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

interface Pkg { id:string; name:string|null; publicCode:number|null; basePrice?:number; isActive:boolean; }
interface Product { id:string; name:string; description?:string; isActive:boolean; packages:Pkg[] }

export const dynamic = 'force-dynamic';

export default function DevEditProductPage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [product,setProduct]=useState<Product|null>(null);
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [saving,setSaving]=useState(false);
  const [autoSaving,setAutoSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newPkgName,setNewPkgName]=useState('');
  const [newPkgCode,setNewPkgCode]=useState('');
  const [newPkgActive,setNewPkgActive]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load = useCallback(async()=>{
    if(!id) return;
    setLoading(true); setError(null);
    try {
  const res = await api.get(`/products/${id}?all=1`);
  const p = res.data;
  setProduct({ id: p.id, name: p.name, description: p.description, isActive: p.isActive !== false, packages: (p.packages||[]).map((k:any)=> ({ id:k.id, name:k.name, publicCode:k.publicCode, basePrice:k.basePrice, isActive: k.isActive !== false })) });
  setName(p.name||'');
  setDescription(p.description||'');
    }catch(e:any){ setError(e?.response?.data?.message||e?.message||'Failed'); }
    finally{ setLoading(false); }
  },[id]);

  useEffect(()=>{ load(); },[load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.back()} className="text-xs px-3 py-1 bg-gray-200 rounded">رجوع</button>
        <h1 className="text-xl font-bold">تعديل المنتج</h1>
      </div>
      {loading && <div className="text-sm">تحميل...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {product && (
        <div className="space-y-4">
          <div className="p-4 border rounded bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">البيانات الأساسية
                {product && (
                  <button
                    onClick={async()=>{
                      const newVal = !product.isActive;
                      setProduct(p=> p? {...p, isActive:newVal}:p);
                      try { await api.put(`/products/${product.id}`, { isActive: newVal }); }
                      catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل تحديث الحالة'); setProduct(p=> p? {...p, isActive:!newVal}:p); }
                    }}
                    className={`w-4 h-4 rounded-full border transition-colors ${product.isActive? 'bg-green-500 border-green-600':'bg-red-500 border-red-600'}`}
                    title={product.isActive? 'نشط - انقر للتعطيل':'معطل - انقر للتفعيل'}
                  />
                )}
              </h2>
              {autoSaving && <span className="text-[10px] text-amber-600 animate-pulse">حفظ تلقائي...</span>}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">الاسم</label>
                <input value={name} onChange={e=>setName(e.target.value)} onBlur={async()=>{
                  if(!product) return; setAutoSaving(true);
                  try { await api.put(`/products/${product.id}`, { name: name.trim()||'بدون اسم' }); }
                  catch(e:any){ console.warn('save name fail', e?.response?.data || e?.message); }
                  finally { setAutoSaving(false); }
                }} className="border rounded px-3 py-1 w-full text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">الوصف</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} onBlur={async()=>{
                  if(!product) return; setAutoSaving(true);
                  try { await api.put(`/products/${product.id}`, { description }); }
                  catch(e:any){ console.warn('save desc fail', e?.response?.data || e?.message); }
                  finally { setAutoSaving(false); }
                }} className="border rounded px-3 py-1 w-full text-sm min-h-[60px]" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">صورة المنتج</label>
              <input type="file" accept="image/*" onChange={e=> setImageFile(e.target.files?.[0]||null)} className="text-xs" />
              <div className="flex gap-2">
                <button disabled={!imageFile||uploading} onClick={async()=>{
                  if(!product||!imageFile) return; setUploading(true);
                  try {
                    const fd = new FormData(); fd.append('image', imageFile);
                    await api.post(`/products/${product.id}/image`, fd, { headers:{'Content-Type':'multipart/form-data'} });
                    await load(); setImageFile(null);
                  } catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل رفع الصورة'); }
                  finally { setUploading(false);} }} className="text-xs px-3 py-1 rounded bg-sky-600 text-white disabled:opacity-50">رفع الصورة</button>
                {imageFile && <span className="text-[10px] text-gray-500">{imageFile.name}</span>}
              </div>
            </div>
            <div className="text-[11px] text-gray-500">ID: {product.id}</div>
          </div>
          <div className="p-3 border rounded bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">الباقات ({product.packages.length}) <span className="text-[10px] text-gray-500">(السوب دومين سيرى فقط الباقات ذات publicCode لكنك ترى الكل هنا)</span></h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input value={newPkgName} onChange={e=>setNewPkgName(e.target.value)} placeholder="اسم باقة" className="border rounded px-2 py-1" />
                <input value={newPkgCode} onChange={e=> setNewPkgCode(e.target.value.replace(/[^0-9]/g,''))} placeholder="كود" className="border rounded px-2 py-1 w-24" maxLength={9} />
                <label className="flex items-center gap-1 select-none">
                  <input type="checkbox" checked={newPkgActive} onChange={e=> setNewPkgActive(e.target.checked)} /> نشطة
                </label>
                <button disabled={adding||!newPkgName.trim()} onClick={async()=>{
                  if(!product) return; setAdding(true);
                  try {
                    const payload: any = { name: newPkgName.trim(), isActive: newPkgActive };
                    if(newPkgCode){ const n=Number(newPkgCode); if(Number.isInteger(n) && n>0) payload.publicCode = n; }
                    await api.post(`/products/${product.id}/packages`, payload);
                    setNewPkgName(''); setNewPkgCode(''); setNewPkgActive(true); await load();
                  }catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل إضافة الباقة'); }
                  finally { setAdding(false);} }} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">+ باقة</button>
              </div>
            </div>
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-right">#</th>
                  <th className="px-2 py-1 text-right">الاسم</th>
                  <th className="px-2 py-1 text-right">الكود</th>
                  <th className="px-2 py-1 text-right">نشط</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {product.packages.map((pk,i)=>(
                  <tr key={pk.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1 w-40">
                      <input defaultValue={pk.name||''} onBlur={async(e)=>{ const v=e.target.value.trim()||'بدون اسم'; try { await api.put(`/products/packages/${pk.id}`, { name: v }); } catch(err:any){ alert(err?.response?.data?.message||err?.message||'فشل حفظ الاسم'); } }} className="border rounded px-2 py-0.5 w-full text-xs" />
                    </td>
                    <td className="px-2 py-1 w-32">
                      <input defaultValue={pk.publicCode??''} onBlur={async(e)=>{ const v=e.target.value.trim(); try { await api.patch(`/products/packages/${pk.id}/code`, { publicCode: v? Number(v): null }); } catch(err:any){ alert(err?.response?.data?.message||err?.message||'فشل حفظ الكود'); } }} className="border rounded px-2 py-0.5 w-full text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={async()=>{
                          const newVal = !pk.isActive;
                          setProduct(p=> p? {...p, packages: p.packages.map(pp=> pp.id===pk.id? {...pp, isActive:newVal}:pp)}:p);
                          try { await api.put(`/products/packages/${pk.id}`, { isActive: newVal }); }
                          catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل تحديث حالة الباقة'); setProduct(p=> p? {...p, packages: p.packages.map(pp=> pp.id===pk.id? {...pp, isActive:!newVal}:pp)}:p); }
                        }}
                        className={`w-4 h-4 rounded-full border transition-colors ${pk.isActive? 'bg-green-500 border-green-600':'bg-red-500 border-red-600'}`}
                        title={pk.isActive? 'نشطة - انقر للتعطيل':'معطلة - انقر للتفعيل'}
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={async()=>{ if(!confirm('حذف الباقة؟')) return; try { await api.delete(`/products/packages/${pk.id}`); await load(); } catch(err:any){ alert(err?.response?.data?.message||err?.message||'فشل الحذف'); } }} className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">حذف</button>
                    </td>
                    {/* TODO: per-package edit / toggle active */}
                  </tr>
                ))}
                {product.packages.length===0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-400">لا توجد باقات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
