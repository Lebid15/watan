"use client";
// منع الكاش أثناء التطوير لهذه الصفحة (App Router)
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  // فلاتر
  // البحث الجديد عبر قائمة منسدلة تحتوي كل المنتجات
  const [q,setQ]=useState(''); // يستخدم داخل صندوق البحث داخل القائمة المنسدلة فقط (لا يفلتر تلقائياً حتى يتم الاختيار)
  const [productSelectOpen,setProductSelectOpen]=useState(false);
  const [selectedProductId,setSelectedProductId]=useState<string|undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement|null>(null);
  // تمت إزالة باقي الفلاتر (الحالة/العدد/الانتباه) حسب الطلب
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
  const filtered = useMemo(()=>{
    if(!selectedProductId) return products;
    return products.filter(p=> p.id===selectedProductId);
  },[products,selectedProductId]);

  // إغلاق القائمة عند الضغط خارجها
  useEffect(()=>{
    if(!productSelectOpen) return;
    const fn = (e:MouseEvent)=>{
      if(!dropdownRef.current) return;
      if(!dropdownRef.current.contains(e.target as any)) setProductSelectOpen(false);
    };
    window.addEventListener('mousedown',fn);
    return ()=> window.removeEventListener('mousedown',fn);
  },[productSelectOpen]);

  const productOptions = useMemo(()=>{
    if(!q) return products;
    return products.filter(p=> p.name.toLowerCase().includes(q.toLowerCase()));
  },[products,q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
  <h1 className="text-2xl font-bold">كل المنتجات (Devv)</h1>
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
        <button
          onClick={()=> router.push('/dev/filtered-products/new')}
          className="px-4 py-1.5 rounded text-sm bg-emerald-600 text-white"
        >+ إضافة منتج</button>
        {/* قائمة المنتجات المنسدلة مع بحث داخلي */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={()=> setProductSelectOpen(o=>!o)}
            className="px-3 py-1.5 rounded border text-sm bg-white min-w-52 flex items-center justify-between gap-2"
          >
            <span className="truncate text-right flex-1">
              {selectedProductId? (products.find(p=>p.id===selectedProductId)?.name || '—'): 'اختر منتجاً أو ابحث...'}
            </span>
            <span className="text-xs text-gray-500">▾</span>
          </button>
          {productSelectOpen && (
            <div className="absolute z-20 mt-1 w-72 rounded border bg-white shadow-lg p-2 space-y-2 max-h-96 flex flex-col">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="بحث..."
                  className="flex-1 px-2 py-1 rounded border text-sm"
                />
                {selectedProductId && (
                  <button
                    onClick={()=>{ setSelectedProductId(undefined); setQ(''); }}
                    className="text-xs px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100"
                  >مسح</button>
                )}
              </div>
              <div className="overflow-auto divide-y rounded border bg-gray-50">
                <button
                  onClick={()=>{ setSelectedProductId(undefined); setProductSelectOpen(false); setQ(''); }}
                  className={`w-full text-right px-3 py-1.5 text-sm hover:bg-white ${!selectedProductId? 'bg-white font-semibold':''}`}
                >الكل</button>
                <div className="max-h-60 overflow-auto">
                  {productOptions.map(p=> (
                    <button
                      key={p.id}
                      onClick={()=>{ setSelectedProductId(p.id); setProductSelectOpen(false); }}
                      className={`w-full text-right px-3 py-1.5 text-sm hover:bg-white ${selectedProductId===p.id? 'bg-white font-semibold':''}`}
                    >{p.name}
                      <span className="text-[10px] text-gray-500 mr-2">{p.packages.length} باقات</span>
                    </button>
                  ))}
                  {productOptions.length===0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">لا نتائج</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
  {/* أزيلت الفلاتر الأخرى */}
        {loading && <span className="text-sm text-gray-500 animate-pulse">تحميل...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
    {selectedProductId && (
          <button
      onClick={()=>{ setQ(''); setSelectedProductId(undefined); }}
            className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
            title="إلغاء الفلاتر"
          >إلغاء الفلاتر</button>
        )}
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
                  <span className="text-white">{prod.name}</span>
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
