"use client";
// منع الكاش أثناء التطوير لهذه الصفحة (App Router)
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';

interface DevPackage {
  id: string;
  name: string | null;
  publicCode: string | null; // محفوظ كنص للعرض حتى لو API يرجع رقم
  basePrice?: number;
  isActive?: boolean;
}
interface DevProduct {
  id: string;
  name: string;
  packages: DevPackage[];
}

export default function DevFilteredProductsPage(){
  const router = useRouter();
  const [products,setProducts]=useState<DevProduct[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [backendMeta,setBackendMeta]=useState<{gitSha?:string;buildTime?:string;version?:string}>({});
  const [textFilter,setTextFilter]=useState('');      // فلتر نصي بالاسم
  const [saving,setSaving]=useState<Record<string,boolean>>({});
  const [deleting,setDeleting]=useState<Record<string,boolean>>({});
  const [showRefreshConfirm,setShowRefreshConfirm]=useState(false);
  const [showProductDropdown,setShowProductDropdown]=useState(false);
  const [productSearch,setProductSearch]=useState('');
  const [selectedProductId,setSelectedProductId]=useState<string|undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement|null>(null);

  const load = useCallback(async()=>{
    setLoading(true); setError(null); setShowRefreshConfirm(false);
    try {
      const res = await api.get('/products?all=1');
      const raw = Array.isArray(res.data)? res.data : (res.data?.items||[]);
      const mapped: DevProduct[] = raw.map((p:any)=>({
        id: p.id,
        name: p.name,
        packages: (p.packages||[]).map((k:any)=>({
          id: k.id,
          name: k.name,
          publicCode: k.publicCode == null ? null : String(k.publicCode),
          basePrice: Number(k.basePrice ?? 0),
          isActive: k.isActive,
        }))
      }));
      if (!Array.isArray(mapped) || mapped.length===0) {
        // Debug فقط مؤقت
        console.log('[DEV][filtered-products] raw products payload =', raw);
      }
      setProducts(mapped);
      // fetch backend meta in parallel (non-blocking)
      api.get('/health').then(r=>{
        setBackendMeta({gitSha:r.data.gitSha, buildTime:r.data.buildTime, version:r.data.version});
      }).catch(()=>{});
    }catch(e:any){ setError(e?.message||'فشل التحميل'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  // إغلاق القائمة المنسدلة عند الضغط خارجها
  useEffect(()=>{
    function onDoc(e:MouseEvent){
      if(!showProductDropdown) return;
      if(dropdownRef.current && !dropdownRef.current.contains(e.target as any)){
        setShowProductDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return ()=> document.removeEventListener('mousedown', onDoc);
  },[showProductDropdown]);

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
      const res = await api.patch(`/products/packages/${pkgId}/code`, { publicCode: num });
      const finalCode = res.data?.publicCode ?? num;
      setProducts(ps=> ps.map(p=> ({...p, packages: p.packages.map(pk=> pk.id===pkgId? {...pk, publicCode: finalCode == null ? null : String(finalCode)}:pk)})));
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

  const nameFiltered = products.filter(p=> !textFilter.trim() || p.name.toLowerCase().includes(textFilter.toLowerCase()));
  const filtered = selectedProductId ? nameFiltered.filter(p=>p.id===selectedProductId) : nameFiltered;
  const productOptions = products; // كامل القائمة
  const totalPackages = filtered.reduce((acc,p)=> acc + p.packages.length, 0);
  const activePackages = filtered.reduce((acc,p)=> acc + p.packages.filter(pk=>pk.isActive).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">المنتجات والباقات7 (Dev / All)</h1>
        <div className="text-xs bg-gray-800 text-white px-3 py-1 rounded shadow flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono" title="Frontend Git SHA">F:{process.env.NEXT_PUBLIC_GIT_SHA || 'dev'}</span>
            <span className="opacity-70" title="Frontend Build Time">{(process.env.NEXT_PUBLIC_BUILD_TIME||'').replace('T',' ').replace(/\..+/, '')}</span>
          </div>
            {backendMeta.gitSha && (
              <div className="flex items-center gap-2 text-[10px] opacity-90">
                <span className="font-mono" title="Backend Git SHA">B:{backendMeta.gitSha}</span>
                <span className="opacity-70" title="Backend Build Time">{(backendMeta.buildTime||'').replace('T',' ').replace(/\..+/, '')}</span>
              </div>
            )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-center relative">
        {/* زر تحديث + حوار تأكيد */}
        <button
          onClick={()=> setShowRefreshConfirm(true)}
          disabled={loading}
          className="px-4 py-1.5 rounded text-sm bg-blue-600 text-white disabled:opacity-50"
        >تحديث</button>
        {showRefreshConfirm && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-3 py-1 rounded text-xs">
            <span>تأكيد التحديث؟</span>
            <button onClick={async()=>{ try { const res = await api.post('/dev/filtered-products-sync'); console.log('[DEV][filtered-products] sync stats =', res.data); if(res.data?.fallbackSeeded){ alert('لا توجد بيانات كتالوج، تم إنشاء ديمو للعرض'); } } catch(e:any){ console.log('sync error', e?.response?.data||e?.message);} finally { await load(); } }} className="px-2 py-0.5 bg-amber-600 text-white rounded">تأكيد</button>
            <button onClick={()=> setShowRefreshConfirm(false)} className="px-2 py-0.5 bg-gray-300 rounded">إلغاء</button>
          </div>
        )}
        {/* زر إضافة منتج جديد */}
        <button
          onClick={()=> router.push('/dev/filtered-products/new')}
          className="px-4 py-1.5 rounded text-sm bg-emerald-600 text-white"
        >+ إضافة منتج</button>
        {/* فلتر نصي */}
        <input
          value={textFilter}
          onChange={e=> setTextFilter(e.target.value)}
          placeholder="بحث بالاسم..."
          className="border rounded px-3 py-1 text-sm"
        />
        {/* قائمة المنتجات المنسدلة */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={()=> setShowProductDropdown(s=>!s)}
            className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50"
          >{selectedProductId ? (products.find(p=>p.id===selectedProductId)?.name || 'منتج') : 'كل المنتجات ▼'}</button>
          {showProductDropdown && (
            <div className="absolute z-20 mt-1 w-64 max-h-80 overflow-auto bg-white border rounded shadow-lg p-2 space-y-2">
              <input
                autoFocus
                value={productSearch}
                onChange={e=> setProductSearch(e.target.value)}
                placeholder="بحث داخل القائمة..."
                className="w-full border rounded px-2 py-1 text-xs"
              />
              <button
                onClick={()=> { setSelectedProductId(undefined); setShowProductDropdown(false); }}
                className="w-full text-right text-xs px-2 py-1 rounded hover:bg-gray-100 font-medium"
              >كل المنتجات</button>
              <div className="divide-y divide-gray-100"></div>
              {productOptions
                .filter(p=> !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                .map(p=> (
                  <button
                    key={p.id}
                    onClick={()=> { setSelectedProductId(p.id); setShowProductDropdown(false); }}
                    className={`w-full text-right text-xs px-2 py-1 rounded hover:bg-gray-100 ${p.id===selectedProductId? 'bg-sky-50 font-semibold':''}`}
                  >{p.name}</button>
                ))}
              {productOptions.filter(p=> !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase())).length===0 && (
                <div className="text-center text-gray-400 text-xs py-2">لا نتائج</div>
              )}
            </div>
          )}
        </div>
  {loading && <span className="text-sm text-gray-500 animate-pulse">تحميل...</span>}
  <span className="text-xs text-gray-600">المنتجات: {filtered.length} | الباقات: {activePackages}/{totalPackages} نشطة</span>
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
                    <th className="px-2 py-1 text-right">المزوّد</th>
                    <th className="px-2 py-1 text-right">السعر الأساس</th>
                    <th className="px-2 py-1 text-right">نشطة</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {prod.packages.map((pkg,i)=>(
                    <tr key={pkg.id} className={`odd:bg-white even:bg-gray-50 hover:bg-yellow-50 ${!pkg.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-2 py-1">{i+1}</td>
                      <td className="px-2 py-1 font-medium">{pkg.name}</td>
                      <td className="px-2 py-1 w-40">
                        <input
                          defaultValue={pkg.publicCode || ''}
                          onBlur={e=> updateCode(pkg.id, e.target.value)}
                          placeholder="كود"
                          maxLength={9}
                          className="w-full border rounded px-2 py-0.5 text-xs focus:outline-none focus:ring"
                          disabled={!!saving[pkg.id]}
                        />
                      </td>
                      <td className="px-2 py-1">-</td>
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
