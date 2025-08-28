"use client";
import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

interface DevPackage {
  id: string;
  name: string | null;
  publicCode: string | null;
  basePrice?: number;
  isActive?: boolean;
}
interface DevProduct {
  id: string;
  name: string;
  packages: DevPackage[];
}

export default function DevFilteredProductsPage(){
  const [products,setProducts]=useState<DevProduct[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState('');
  const [confirmRefresh,setConfirmRefresh]=useState(false);
  const [saving,setSaving]=useState<Record<string,boolean>>({});
  const [deleting,setDeleting]=useState<Record<string,boolean>>({});

  const load = useCallback(async()=>{
    if(!confirmRefresh){
      // أول ضغطة تُحوّل للتاكيد
      setConfirmRefresh(true);
      return;
    }
    setLoading(true); setError(null); setConfirmRefresh(false);
    try {
      const res = await api.get('/products?all=1');
      const raw = Array.isArray(res.data)? res.data : (res.data?.items||[]);
      const mapped: DevProduct[] = raw.map((p:any)=>({
        id: p.id,
        name: p.name,
        packages: (p.packages||[]).map((k:any)=>({
          id: k.id,
          name: k.name,
          publicCode: k.publicCode ?? null,
          basePrice: Number(k.basePrice ?? 0),
          isActive: k.isActive,
        }))
      }));
      setProducts(mapped);
    }catch(e:any){ setError(e?.message||'فشل التحميل'); }
    finally{ setLoading(false); }
  },[confirmRefresh]);

  useEffect(()=>{ load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const setPkgSaving = (id:string,val:boolean)=> setSaving(s=>({...s,[id]:val}));
  const setPkgDeleting = (id:string,val:boolean)=> setDeleting(s=>({...s,[id]:val}));

  const updateCode = async (pkgId:string, value:string)=>{
    const v = value.trim();
    if(v===''){
      setPkgSaving(pkgId,true);
      try {
        await api.patch(`/products/packages/${pkgId}/code`, { publicCode: null });
        setProducts(ps=> ps.map(p=> ({...p, packages: p.packages.map(pk=> pk.id===pkgId? {...pk, publicCode:null}:pk)})));
      }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل مسح الكود'); }
      finally { setPkgSaving(pkgId,false); }
      return;
    }
    const num = Number(v);
    if(!Number.isInteger(num) || num < 1) return; // تجاهل غير الصحيح
    setPkgSaving(pkgId,true);
    try {
      await api.patch(`/products/packages/${pkgId}/code`, { publicCode: num });
      setProducts(ps=> ps.map(p=> ({...p, packages: p.packages.map(pk=> pk.id===pkgId? {...pk, publicCode:String(num)}:pk)})));
    }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل حفظ الكود'); }
    finally{ setPkgSaving(pkgId,false); }
  };

  const deletePackage = async (pkgId:string)=>{
    if(!confirm('تأكيد حذف الباقة؟')) return;
    setPkgDeleting(pkgId,true);
    try {
      await api.delete(`/products/packages/${pkgId}`);
      setProducts(ps=> ps.map(p=> ({...p, packages: p.packages.filter(pk=>pk.id!==pkgId)})));
    }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل الحذف'); }
    finally{ setPkgDeleting(pkgId,false); }
  };

  const deleteProduct = async (productId:string)=>{
    if(!confirm('تأكيد حذف المنتج وكل باقاته؟')) return;
    setPkgDeleting(productId,true);
    try {
      await api.delete(`/products/${productId}`);
      setProducts(ps=> ps.filter(p=>p.id!==productId));
    }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل حذف المنتج'); }
    finally{ setPkgDeleting(productId,false); }
  };

  const filtered = products.filter(p=> !filter.trim() || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المنتجات والباقات (Dev / All)</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="بحث عن منتج..." className="border rounded px-3 py-1 text-sm" />
        <button onClick={load} disabled={loading} className={"px-4 py-1.5 rounded text-sm text-white disabled:opacity-50 " + (confirmRefresh? 'bg-amber-600':'bg-blue-600')}>{confirmRefresh? 'اضغط تأكيد التحديث' : 'تحديث'}</button>
        {loading && <span className="text-sm text-gray-500 animate-pulse">تحميل...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <div className="space-y-6">
        {filtered.map(prod=> (
          <div key={prod.id} className="border rounded shadow-sm bg-white">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="font-semibold text-sm">{prod.name} <span className="text-xs text-gray-400">({prod.packages.length} باقات)</span></div>
              <div className="flex gap-2">
                <button onClick={()=>deleteProduct(prod.id)} disabled={!!deleting[prod.id]} className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50">حذف المنتج</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-right">#</th>
                    <th className="px-2 py-1 text-right">الباقة</th>
                    <th className="px-2 py-1 text-right">الكود</th>
                    <th className="px-2 py-1 text-right">السعر الأساس</th>
                    <th className="px-2 py-1 text-right">نشطة</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {prod.packages.map((pkg,i)=>(
                    <tr key={pkg.id} className="odd:bg-white even:bg-gray-50 hover:bg-yellow-50">
                      <td className="px-2 py-1">{i+1}</td>
                      <td className="px-2 py-1 font-medium">{pkg.name}</td>
                      <td className="px-2 py-1 w-40">
                        <input
                          defaultValue={pkg.publicCode || ''}
                          onBlur={e=> updateCode(pkg.id, e.target.value)}
                          placeholder="كود"
                          className="w-full border rounded px-2 py-0.5 text-xs focus:outline-none focus:ring"
                          disabled={!!saving[pkg.id]}
                        />
                      </td>
                      <td className="px-2 py-1">{pkg.basePrice}</td>
                      <td className="px-2 py-1">{pkg.isActive? '✓':'✗'}</td>
                      <td className="px-2 py-1 text-center">
                        <button onClick={()=>deletePackage(pkg.id)} disabled={!!deleting[pkg.id]} className="text-xs px-2 py-0.5 rounded bg-red-500 text-white disabled:opacity-50">حذف</button>
                      </td>
                    </tr>
                  ))}
                  {prod.packages.length===0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-gray-400">لا توجد باقات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!loading && filtered.length===0 && <div className="text-center text-gray-500 py-10">لا توجد منتجات</div>}
        {loading && <div className="text-center text-gray-400 py-10 animate-pulse">تحميل...</div>}
      </div>
    </div>
  );
}
