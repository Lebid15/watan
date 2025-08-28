"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

interface Pkg { id:string; name:string|null; publicCode:number|null; basePrice?:number; isActive?:boolean; }
interface Product { id:string; name:string; description?:string; packages:Pkg[] }

export const dynamic = 'force-dynamic';

export default function DevEditProductPage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [product,setProduct]=useState<Product|null>(null);
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [saving,setSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newPkgName,setNewPkgName]=useState('');
  const [newPkgCode,setNewPkgCode]=useState('');
  const [uploading,setUploading]=useState(false);
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load = useCallback(async()=>{
    if(!id) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/products/${id}?all=1`);
  setProduct(res.data);
  setName(res.data.name||'');
  setDescription(res.data.description||'');
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
              <h2 className="font-semibold text-sm">البيانات الأساسية</h2>
              <button disabled={saving} onClick={async()=>{
                if(!product) return;
                setSaving(true);
                try { await api.put(`/products/${product.id}`, { name: name.trim()||'بدون اسم', description }); await load(); } catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل الحفظ'); } finally { setSaving(false);} }} className="text-xs px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">حفظ</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">الاسم</label>
                <input value={name} onChange={e=>setName(e.target.value)} className="border rounded px-3 py-1 w-full text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">الوصف</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} className="border rounded px-3 py-1 w-full text-sm min-h-[60px]" />
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
              <h2 className="font-semibold text-sm">الباقات ({product.packages.length})</h2>
              <div className="flex items-center gap-2 text-xs">
                <input value={newPkgName} onChange={e=>setNewPkgName(e.target.value)} placeholder="اسم باقة" className="border rounded px-2 py-1" />
                <input value={newPkgCode} onChange={e=> setNewPkgCode(e.target.value.replace(/[^0-9]/g,''))} placeholder="كود" className="border rounded px-2 py-1 w-24" maxLength={9} />
                <button disabled={adding||!newPkgName.trim()} onClick={async()=>{
                  if(!product) return; setAdding(true);
                  try {
                    const payload: any = { name: newPkgName.trim() };
                    if(newPkgCode){ const n=Number(newPkgCode); if(Number.isInteger(n) && n>0) payload.publicCode = n; }
                    await api.post(`/products/${product.id}/packages`, payload);
                    setNewPkgName(''); setNewPkgCode(''); await load();
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
                  <th className="px-2 py-1 text-right">السعر</th>
                  <th className="px-2 py-1 text-right">نشط</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {product.packages.map((pk,i)=>(
                  <tr key={pk.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">{pk.name}</td>
                    <td className="px-2 py-1 w-32">
                      <input defaultValue={pk.publicCode??''} onBlur={async(e)=>{
                        const v = e.target.value.trim();
                        try {
                          await api.patch(`/products/packages/${pk.id}/code`, { publicCode: v? Number(v): null });
                          await load();
                        } catch(err:any){ alert(err?.response?.data?.message||err?.message||'فشل حفظ الكود'); }
                      }} className="border rounded px-2 py-0.5 w-full text-xs"/>
                    </td>
                    <td className="px-2 py-1">{pk.basePrice ?? '-'}</td>
                    <td className="px-2 py-1">{pk.isActive ? '✓':'✗'}</td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={async()=>{ if(!confirm('حذف الباقة؟')) return; try { await api.delete(`/products/packages/${pk.id}`); await load(); } catch(err:any){ alert(err?.response?.data?.message||err?.message||'فشل الحذف'); } }} className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">حذف</button>
                    </td>
                    {/* TODO: per-package edit / toggle active */}
                  </tr>
                ))}
                {product.packages.length===0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-gray-400">لا توجد باقات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
