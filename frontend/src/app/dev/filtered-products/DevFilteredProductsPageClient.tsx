"use client";
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';

interface DevPackage { id: string; name: string | null; publicCode: string | null; isActive: boolean; }
interface DevProduct { id: string; name: string; packages: DevPackage[]; isActive: boolean; }

export default function DevFilteredProductsPageClient(){
  const router = useRouter();
  const [products,setProducts]=useState<DevProduct[]>([]);
  const [tenantHost,setTenantHost] = useState<string>(()=>{
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('dev_tenant_host')||'';
  });
  const [tenantId,setTenantId] = useState<string>(()=>{
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('dev_tenant_id')||'';
  });
  const [q,setQ]=useState('');
  const [productSelectOpen,setProductSelectOpen]=useState(false);
  const [selectedProductId,setSelectedProductId]=useState<string|undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [backendMeta,setBackendMeta]=useState<{gitSha?:string;buildTime?:string;version?:string}>({});
  const [deleting,setDeleting]=useState<Record<string,boolean>>({});
  const [cloneOpen,setCloneOpen]=useState(false);
  const [globalLoading,setGlobalLoading]=useState(false);
  const [globalProducts,setGlobalProducts]=useState<any[]>([]);
  const [globalQ,setGlobalQ]=useState('');
  const [globalSelected,setGlobalSelected]=useState<string|undefined>();
  const [cloning,setCloning]=useState(false);

  const loadGlobal = async()=>{ setGlobalLoading(true); try { const res = await api.get('/products/global'); const items = res.data?.items||[]; setGlobalProducts(items);}catch(e:any){ console.error('فشل جلب المنتجات العالمية', e?.message); } finally{ setGlobalLoading(false); } };

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const headers: Record<string,string> = {};
      // Prefer explicit tenant id, else host
      if (tenantId.trim()) headers['X-Tenant-Id'] = tenantId.trim();
      else if (tenantHost.trim()) headers['X-Tenant-Host'] = tenantHost.trim();
      const res = await api.get('/products?all=1', { headers });
      const raw = Array.isArray(res.data)? res.data : (res.data?.items||[]);
      const mapped: DevProduct[] = raw.map((p:any): DevProduct => ({ id: p.id, name: p.name, isActive: p.isActive !== false, packages: (p.packages||[]).map((k:any): DevPackage => ({ id: k.id, name: k.name, publicCode: k.publicCode == null ? null : String(k.publicCode), isActive: k.isActive !== false, })) }));
      if (!Array.isArray(mapped) || mapped.length===0) { console.log('[DEV][filtered-products] raw products payload =', raw); }
      setProducts(mapped);
      api.get('/health').then(r=>{ setBackendMeta({gitSha:r.data.gitSha, buildTime:r.data.buildTime, version:r.data.version}); }).catch(()=>{});
    }catch(e:any){ setError(e?.response?.data?.message||e?.message||'فشل التحميل'); }
    finally{ setLoading(false); }
  },[tenantHost,tenantId]);
  useEffect(()=>{ load(); },[load]);

  const setPkgDeleting = (id:string,val:boolean)=> setDeleting(s=>({...s,[id]:val}));
  const deleteProduct = async (productId:string)=>{ if(!confirm('تأكيد حذف المنتج وكل باقاته؟')) return; setPkgDeleting(productId,true); try { await api.delete(`/products/${productId}`); setProducts(ps=> ps.filter(p=>p.id!==productId)); }catch(e:any){ alert(e?.response?.data?.message || e?.message || 'فشل حذف المنتج'); } finally{ setPkgDeleting(productId,false); } };
  const filtered = useMemo(()=>{ if(!selectedProductId) return products; return products.filter(p=> p.id===selectedProductId); },[products,selectedProductId]);
  useEffect(()=>{ if(!productSelectOpen) return; const fn = (e:MouseEvent)=>{ if(!dropdownRef.current) return; if(!dropdownRef.current.contains(e.target as any)) setProductSelectOpen(false); }; window.addEventListener('mousedown',fn); return ()=> window.removeEventListener('mousedown',fn); },[productSelectOpen]);
  const productOptions = useMemo(()=>{ if(!q) return products; return products.filter(p=> p.name.toLowerCase().includes(q.toLowerCase())); },[products,q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">كل المنتجات (Dev2)</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/dev/filtered-products/new')}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            منتج جديد
          </button>
          <button
            onClick={() => setCloneOpen(!cloneOpen)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            استنساخ من العالمي
          </button>
        </div>
      </div>

      {/* Tenant context selector (developer on apex) */}
      <div className="p-3 border rounded bg-white flex flex-col gap-2">
        <div className="text-xs text-gray-600 leading-relaxed">
          كـ مطوّر على النطاق الرئيسي تحتاج لاختيار سياق المستأجر حتى تُعرض المنتجات وتتمكن من الإنشاء. أدخل إما Host (مثل sham.syrz1.com) أو معرف التينانت (UUID). يتم حفظ الاختيار محلياً.
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <div className="flex flex-col gap-1 w-full md:w-1/3">
            <label className="text-xs font-semibold">Tenant Host</label>
            <input value={tenantHost} onChange={e=>setTenantHost(e.target.value)} placeholder="مثال: sham.syrz1.com" className="border rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1 w-full md:w-1/3">
            <label className="text-xs font-semibold">Tenant Id (بديل)</label>
            <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="UUID" className="border rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{
              if (typeof window !== 'undefined') {
                if (tenantHost.trim()) {
                  localStorage.setItem('dev_tenant_host', tenantHost.trim());
                  document.cookie = `tenant_host=${tenantHost.trim()}; path=/`;
                }
                else localStorage.removeItem('dev_tenant_host');
                if (tenantId.trim()) localStorage.setItem('dev_tenant_id', tenantId.trim()); else localStorage.removeItem('dev_tenant_id');
              }
              load();
            }} className="bg-gray-800 text-white text-sm px-4 py-2 rounded">تحديث السياق</button>
            <button onClick={()=>{
              setTenantHost(''); setTenantId('');
              if (typeof window !== 'undefined') {
                localStorage.removeItem('dev_tenant_host');
                localStorage.removeItem('dev_tenant_id');
                document.cookie = 'tenant_host=; path=/; max-age=0';
              }
              load();
            }} className="bg-gray-200 text-sm px-4 py-2 rounded">مسح</button>
          </div>
        </div>
        {(!tenantHost && !tenantId) && <div className="text-[11px] text-amber-700">لم يتم تحديد مستأجر بعد — لن تظهر منتجات حتى اختيار واحد.</div>}
      </div>

  {loading && <div className="text-sm">تحميل...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setProductSelectOpen(!productSelectOpen)}
          className="flex items-center gap-2 px-3 py-2 border rounded bg-white"
        >
          <span className="text-sm">
            {selectedProductId ? products.find(p => p.id === selectedProductId)?.name || 'منتج محدد' : 'كل المنتجات'}
          </span>
          <span className="text-xs">▼</span>
        </button>
        
        {productSelectOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded shadow-lg z-10">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="بحث..."
              className="w-full px-3 py-2 border-b text-sm"
            />
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => { setSelectedProductId(undefined); setProductSelectOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                كل المنتجات
              </button>
              {productOptions.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProductId(p.id); setProductSelectOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-right">#</th>
              <th className="px-4 py-2 text-right">الاسم</th>
              <th className="px-4 py-2 text-right">الباقات</th>
              <th className="px-4 py-2 text-right">نشط</th>
              <th className="px-4 py-2 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, index) => (
              <tr key={product.id} className="odd:bg-white even:bg-gray-50">
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2 font-medium">{product.name}</td>
                <td className="px-4 py-2">{product.packages.length}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${product.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dev/filtered-products/${product.id}`)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      disabled={deleting[product.id]}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting[product.id] ? 'حذف...' : 'حذف'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  لا توجد منتجات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cloneOpen && (
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">استنساخ من المنتجات العالمية</h3>
            <button
              onClick={() => setCloneOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {globalLoading && <div className="text-sm">تحميل المنتجات العالمية...</div>}
          
          <div className="space-y-2">
            <input
              value={globalQ}
              onChange={e => setGlobalQ(e.target.value)}
              placeholder="بحث في المنتجات العالمية..."
              className="w-full px-3 py-2 border rounded text-sm"
            />
            
            <div className="max-h-48 overflow-y-auto border rounded">
              {globalProducts
                .filter(p => !globalQ || p.name?.toLowerCase().includes(globalQ.toLowerCase()))
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-50">
                    <span className="text-sm">{p.name}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`استنساخ المنتج "${p.name}"؟`)) return;
                        setCloning(true);
                        try {
                          await api.post('/dev/filtered-products/clone', { globalProductId: p.id });
                          await load();
                          setCloneOpen(false);
                        } catch (e: any) {
                          alert(e?.response?.data?.message || e?.message || 'فشل الاستنساخ');
                        } finally {
                          setCloning(false);
                        }
                      }}
                      disabled={cloning}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {cloning ? 'استنساخ...' : 'استنساخ'}
                    </button>
                  </div>
                ))}
            </div>
            
            <button
              onClick={loadGlobal}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              تحديث القائمة
            </button>
          </div>
        </div>
      )}

      {backendMeta.gitSha && (
        <div className="text-xs text-gray-500">
          Build: {backendMeta.gitSha?.substring(0, 8)} | {backendMeta.buildTime}
        </div>
      )}
    </div>
  );
}
