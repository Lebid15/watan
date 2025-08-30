"use client";
// منع الكاش أثناء التطوير لهذه الصفحة (App Router)
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';

interface DevPackage {
  id: string;
  name: string | null;
  publicCode: string | null; // كود الربط
  isActive: boolean;
}
interface DevProduct {
  id: string;
  name: string;
  packages: DevPackage[];
  isActive: boolean; // مخزن في الباك اند
}

export default function DevFilteredProductsPage(){
  const router = useRouter();
  const [products,setProducts]=useState<DevProduct[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [backendMeta,setBackendMeta]=useState<{gitSha?:string;buildTime?:string;version?:string}>({});
  const [deleting,setDeleting]=useState<Record<string,boolean>>({});

  const load = useCallback(async()=>{
  setLoading(true); setError(null);
    try {
      const res = await api.get('/products?all=1');
      const raw = Array.isArray(res.data)? res.data : (res.data?.items||[]);
      const mapped: DevProduct[] = raw.map((p:any): DevProduct => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive !== false,
        packages: (p.packages||[]).map((k:any): DevPackage => ({
          id: k.id,
          name: k.name,
          publicCode: k.publicCode == null ? null : String(k.publicCode),
          isActive: k.isActive !== false,
        }))
      }));
      if (!Array.isArray(mapped) || mapped.length===0) {
        // Debug فقط مؤقت
        console.log('[DEV][filtered-products] raw products payload =', raw);
      }
      setProducts(mapped);
  // fetch backend meta (اختياري)
  api.get('/health').then(r=>{ setBackendMeta({gitSha:r.data.gitSha, buildTime:r.data.buildTime, version:r.data.version}); }).catch(()=>{});
  // أوقفنا جلب الكتالوج المنفصل هنا مؤقتًا
    }catch(e:any){ setError(e?.message||'فشل التحميل'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  // تبسيط: لا تحرير مباشر للأكواد هنا الآن
  const setPkgDeleting = (id:string,val:boolean)=> setDeleting(s=>({...s,[id]:val}));

  const deleteProduct = async (productId:string)=>{
    if(!confirm('تأكيد حذف المنتج وكل باقاته؟')) return;
    setPkgDeleting(productId,true);
    try {
      await api.delete(`/products/${productId}`);
      setProducts(ps=> ps.filter(p=>p.id!==productId));
    }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل حذف المنتج'); }
    finally{ setPkgDeleting(productId,false); }
  };
  const filtered = products; // تبسيط: لا فلاتر

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
  <h1 className="text-2xl font-bold">كل المنتجات (Dev)</h1>
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
      <div className="flex flex-wrap gap-3 items-center">
        {/* زر إضافة منتج جديد فقط */}
        <button
          onClick={()=> router.push('/dev/filtered-products/new')}
          className="px-4 py-1.5 rounded text-sm bg-emerald-600 text-white"
        >+ إضافة منتج</button>
        {loading && <span className="text-sm text-gray-500 animate-pulse">تحميل...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <div className="space-y-6">
        {filtered.map(prod=> (
          <div key={prod.id} className="border rounded shadow-sm bg-white">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <button
                  onClick={async()=>{
                    const newVal = !prod.isActive;
                    setProducts(ps=> ps.map(p=> p.id===prod.id? {...p, isActive:newVal}:p));
                    try { await api.put(`/products/${prod.id}`, { isActive: newVal }); }
                    catch(e:any){ alert(e?.response?.data?.message||e?.message||'فشل تحديث حالة المنتج'); setProducts(ps=> ps.map(p=> p.id===prod.id? {...p, isActive:!newVal}:p)); }
                  }}
                  title={prod.isActive? 'نشط - انقر للتعطيل':'معطل - انقر للتفعيل'}
                  className={`w-4 h-4 rounded-full border transition-colors ${prod.isActive? 'bg-green-500 border-green-600':'bg-red-500 border-red-600'}`}
                />
                <div className="flex items-center gap-1">
                  <span>{prod.name}</span>
                </div>
                <span className={`text-xs ${prod.packages.length<2? 'text-red-500':'text-gray-400'}`}>({prod.packages.length} باقات)</span>
              </div>
              <div className="flex gap-2">
                <button onClick={()=> router.push(`/dev/filtered-products/${prod.id}`)} className="text-xs px-2 py-1 rounded bg-sky-600 text-white">تفاصيل</button>
                <button onClick={()=>deleteProduct(prod.id)} disabled={!!deleting[prod.id]} className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50">حذف</button>
              </div>
            </div>
            <div className="overflow-auto">
              {/* أزلنا عرض/تحرير الباقات هنا لتبسيط الواجهة */}
            </div>
          </div>
        ))}
  {!loading && filtered.length===0 && <div className="text-center text-gray-500 py-10">لا توجد منتجات</div>}
        {loading && <div className="text-center text-gray-400 py-10 animate-pulse">تحميل...</div>}
      </div>
  {/* الواجهة مبسطة حسب المتطلبات */}
    </div>
  );
}
