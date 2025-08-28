"use client";
import { useState } from 'react';
import api from '@/utils/api';
import { useRouter } from 'next/navigation';

interface NewPkg { id: string; name: string; publicCode: string; isActive: boolean; }

export default function NewProductWithPackagesPage(){
  const [name,setName]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [pkgs,setPkgs]=useState<NewPkg[]>([]);
  const [saving,setSaving]=useState(false);
  const router = useRouter();

  function addPkg(){
    setPkgs(p=>[...p,{ id: Math.random().toString(36).slice(2), name:"", publicCode:"", isActive:true }]);
  }
  function updatePkg(id:string, patch: Partial<NewPkg>){
    setPkgs(p=> p.map(k=> k.id===id? { ...k, ...patch }: k));
  }
  function removePkg(id:string){
    setPkgs(p=> p.filter(k=> k.id!==id));
  }

  async function submit(){
    if(!name.trim()) { alert('الاسم مطلوب'); return; }
    setSaving(true);
    try {
      const prodRes = await api.post('/products', { name: name.trim(), imageUrl: imageUrl.trim()||undefined });
      const productId = prodRes.data.id;
      for (const pkg of pkgs){
        if(!pkg.name.trim()) continue;
        const pc = pkg.publicCode.trim();
        let publicCode: number|undefined = undefined;
        if(pc){ const n=Number(pc); if(Number.isInteger(n) && n>0) publicCode = n; }
        try {
          await api.post(`/products/${productId}/packages`, { name: pkg.name.trim(), publicCode, isActive: pkg.isActive });
        } catch(e:any){ console.warn('فشل إنشاء باقة', pkg, e?.response?.data||e?.message); }
      }
      alert('تم إنشاء المنتج');
      router.push('/dev/filtered-products');
    } catch(e:any){
      alert(e?.response?.data?.message || e?.message || 'فشل إنشاء المنتج');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold">منتج جديد + باقات</h1>
      <div className="space-y-4 bg-white border rounded p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">اسم المنتج</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="border rounded px-3 py-1 w-full" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">رابط الصورة (اختياري)</label>
          <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} className="border rounded px-3 py-1 w-full" />
        </div>
        <div className="flex gap-2">
          <button onClick={addPkg} type="button" className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white">+ إضافة باقة</button>
        </div>
        <div className="space-y-3">
          {pkgs.map((pkg,i)=> (
            <div key={pkg.id} className="border rounded p-3 flex flex-col gap-2 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold">باقة #{i+1}</span>
                <button onClick={()=>removePkg(pkg.id)} className="text-xs text-red-500">حذف</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs">الاسم</label>
                  <input value={pkg.name} onChange={e=>updatePkg(pkg.id,{name:e.target.value})} className="border rounded px-2 py-1 text-xs w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs">الكود (اختياري)</label>
                  <input value={pkg.publicCode} maxLength={9} onChange={e=>updatePkg(pkg.id,{publicCode:e.target.value.replace(/[^0-9]/g,'')})} className="border rounded px-2 py-1 text-xs w-full" />
                </div>
                <div className="space-y-1 flex items-end">
                  <label className="flex items-center gap-1 text-xs select-none">
                    <input type="checkbox" checked={pkg.isActive} onChange={e=>updatePkg(pkg.id,{isActive:e.target.checked})} /> نشطة
                  </label>
                </div>
              </div>
            </div>
          ))}
          {pkgs.length===0 && <div className="text-center text-gray-400 text-sm">لا توجد باقات بعد</div>}
        </div>
        <div className="flex gap-3">
          <button disabled={saving} onClick={submit} className="px-6 py-2 rounded bg-blue-600 text-white disabled:opacity-50 text-sm">حفظ</button>
          <button type="button" onClick={()=> router.push('/dev/filtered-products')} className="px-6 py-2 rounded bg-gray-200 text-sm">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
