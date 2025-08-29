"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_ROUTES } from "@/utils/api";
import { buildImageVariants } from "@/utils/imageVariants";
import api from "@/utils/api";

interface Product {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageSource?: 'catalog' | 'custom' | null;
  useCatalogImage?: boolean;
  hasCustomImage?: boolean;
  customImageUrl?: string | null;
  catalogAltText?: string | null;
  customAltText?: string | null;
  thumbSmallUrl?: string | null;
  thumbMediumUrl?: string | null;
  thumbLargeUrl?: string | null;
  isActive?: boolean;
}

interface CatalogProductAvailable { id: string; name: string; packagesCount: number; }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [availableCatalog, setAvailableCatalog] = useState<CatalogProductAvailable[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const apiHost = useMemo(() => API_ROUTES.products.base.replace(/\/api\/products\/?$/, ""), []);
  const apiBase = useMemo(() => `${apiHost}/api`, [apiHost]);
  const productsUrl = `${apiBase}/products?all=1`;

  const fetchProducts = async () => {
    try {
      const res = await fetch(productsUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("فشل في جلب المنتجات");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e); setProducts([]);
    }
  };
  useEffect(() => { fetchProducts(); }, []);

  function pickImageField(p: Product): string | null { return p.imageUrl || null; }
  function buildImageSrc(raw?: string | null): string {
    if (!raw) return "/images/placeholder.png"; const s = String(raw).trim();
    if (/^https?:\/\//i.test(s)) return s; if (s.startsWith("/")) return `${apiHost}${s}`; return `${apiHost}/${s}`;
  }
  function getImageSrc(p: Product): string { return failed.has(p.id) ? "/images/placeholder.png" : buildImageSrc(pickImageField(p)); }
  function resolveImageSource(p: Product): 'catalog' | 'custom' | 'none' { if (p.imageSource) return p.imageSource || 'none'; const img = pickImageField(p); if (!img) return 'none'; return p.useCatalogImage ? 'catalog' : 'custom'; }

  const fetchAvailableCatalog = async () => {
    if (catalogLoading) return; setCatalogLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/catalog-available`);
      if (!res.ok) throw new Error('فشل في جلب المنتجات الكتالوجية المتاحة');
      const data = await res.json(); setAvailableCatalog(data?.items || []);
    } catch (e) { console.error(e); setAvailableCatalog([]); }
    finally { setCatalogLoading(false); }
  };
  const handleActivate = async (catalogProductId: string) => {
    if (activatingId) return; setActivatingId(catalogProductId);
    try {
      const res = await fetch(`${apiBase}/products/activate-catalog`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ catalogProductId }) });
      if (!res.ok) throw new Error('فشل تفعيل المنتج');
      await fetchProducts(); setAvailableCatalog(prev => prev ? prev.filter(p => p.id !== catalogProductId) : prev); setShowCatalogModal(false);
    } catch (e:any) { alert(e?.message || 'خطأ في التفعيل'); }
    finally { setActivatingId(null); }
  };
  useEffect(() => { if (showCatalogModal && availableCatalog == null) fetchAvailableCatalog(); }, [showCatalogModal]);

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-bg-base))] min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-2 md:px-4 py-2 mb-3 md:mb-4 gap-2 bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))] rounded-lg">
        <h1 className="text-lg md:text-2xl font-bold">إدارة المنتجات</h1>
        <input type="text" placeholder="بحث..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border border-[rgb(var(--color-border))] rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-[rgb(var(--color-bg-input))] text-[rgb(var(--color-text-primary))]" />
        <button onClick={()=>setShowCatalogModal(v=>!v)} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm md:text-base whitespace-nowrap bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-hover))] text-[rgb(var(--color-primary-contrast))]">
          {showCatalogModal ? 'إغلاق' : '+ تفعيل منتج من الكتالوج'}
        </button>
        {selected.size>0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm">
            <span className="text-[rgb(var(--color-text-secondary))]">{selected.size} مختار</span>
            <button disabled={batchBusy} onClick={async()=>{ if(batchBusy) return; setBatchBusy(true); try { await api.post('/admin/products/image/batch-toggle',{ ids:Array.from(selected), useCatalogImage:true }); await fetchProducts(); setSelected(new Set()); } catch(e:any){ alert(e?.response?.data?.message||e.message||'فشل التفعيل الكتالوجي'); } finally { setBatchBusy(false);} }}
              className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">اعتماد كتالوج</button>
            <button disabled={batchBusy} onClick={async()=>{ if(batchBusy) return; setBatchBusy(true); try { await api.post('/admin/products/image/batch-toggle',{ ids:Array.from(selected), useCatalogImage:false }); await fetchProducts(); setSelected(new Set()); } catch(e:any){ alert(e?.response?.data?.message||e.message||'فشل التحويل لمخصص'); } finally { setBatchBusy(false);} }}
              className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">اعتماد مخصص (لو وجد)</button>
            <button disabled={batchBusy} onClick={()=>setSelected(new Set())} className="px-2 py-1 rounded bg-zinc-600 text-white hover:bg-zinc-700 disabled:opacity-50">تفريغ التحديد</button>
          </div>
        )}
      </div>

      {filtered.length===0 ? <p className="px-2 md:px-4 text-[rgb(var(--color-text-secondary))]">لا توجد منتجات.</p> : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 md:gap-4 px-2 md:px-4 py-2">
          {filtered.map(product=>{ const available=product.isActive!==false; const baseImg=product.thumbSmallUrl||product.imageUrl; const imageSrc=getImageSrc(product); const variants=buildImageVariants(imageSrc); const imgSource=resolveImageSource(product); const badgeColor=imgSource==='catalog'?'bg-blue-600':imgSource==='custom'?'bg-emerald-600':'bg-gray-400'; const labelMap:Record<typeof imgSource,string>={catalog:'Catalog',custom:'Custom',none:'None'} as const; const isSelected=selected.has(product.id);
            return (
              <Link key={product.id} href={available?`/admin/products/${product.id}`:'#'} title={product.name}
                className={`group flex flex-col items-center select-none ${available?"cursor-pointer":"opacity-40 pointer-events-none"} ${isSelected?'ring-2 ring-primary':''}`}>
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shadow-md overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 rounded-xl bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))]">
                  <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setSelected(prev=>{ const n=new Set(prev); n.has(product.id)?n.delete(product.id):n.add(product.id); return n;}); }}
                    className={`absolute top-0 left-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold ${isSelected?'bg-primary text-primary-contrast':'bg-zinc-700/70 text-white'} rounded-br`} title={isSelected?'إلغاء التحديد':'تحديد'}>{isSelected?'✓':'+'}</button>
                  {baseImg ? <img src={baseImg||"/images/placeholder.png"} alt={product.name} className="w-3/4 h-3/4 object-contain rounded-lg" loading="lazy"
                    onError={()=>setFailed(prev=>{ if(prev.has(product.id)) return prev; const next=new Set(prev); next.add(product.id); return next; })}
                    data-orig={imageSrc} data-small={variants?.small} data-medium={variants?.medium} /> : <span className="text-[10px] text-[rgb(var(--color-text-secondary))]">No Img</span>}
                  <span className={`absolute -top-1 -left-1 ${badgeColor} text-white text-[9px] md:text-[10px] px-1 py-0.5 rounded-br`}>{labelMap[imgSource]}</span>
                  {!available && <span className="absolute bottom-1 right-1 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-danger))] text-[rgb(var(--color-primary-contrast))]">غير متوفر</span>}
                </div>
                <div className="mt-1.5 md:mt-2 text-center text-[11px] sm:text-[12px] md:text-sm text-[rgb(var(--color-text-primary))] truncate w-16 sm:w-20 md:w-24 flex flex-col items-center gap-0.5">{product.name}{isSelected && <span className="text-[9px] text-primary">محدد</span>}</div>
              </Link>
            ); })}
        </div>
      )}

      {showCatalogModal && (
        <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))] rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <h2 className="font-bold text-base md:text-lg">تفعيل منتج من الكتالوج</h2>
              <button onClick={()=>setShowCatalogModal(false)} className="text-sm text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]">إغلاق</button>
            </div>
            <div className="p-3 flex items-center gap-2 border-b border-[rgb(var(--color-border))]">
              <input type="text" placeholder="بحث في الكتالوج..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                className="flex-1 border border-[rgb(var(--color-border))] rounded-lg px-3 py-1.5 bg-[rgb(var(--color-bg-input))] text-sm" />
              <button onClick={()=>fetchAvailableCatalog()} disabled={catalogLoading}
                className="px-3 py-1.5 rounded-lg text-sm bg-zinc-600 hover:bg-zinc-700 text-white">تحديث</button>
            </div>
            <div className="overflow-auto p-3 space-y-2">
              {catalogLoading && <div className="text-center text-sm text-[rgb(var(--color-text-secondary))] py-6">جاري التحميل...</div>}
              {!catalogLoading && availableCatalog && availableCatalog.length===0 && <div className="text-center text-sm text-[rgb(var(--color-text-secondary))] py-6">لا توجد منتجات متاحة للتفعيل حالياً.</div>}
              {!catalogLoading && availableCatalog && availableCatalog.filter(c=>c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c=>{ const busy=activatingId===c.id; return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated,#1f1f1f))] hover:bg-[rgb(var(--color-bg-hover,#262626))] transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm md:text-base truncate">{c.name}</div>
                    <div className="text-[11px] md:text-xs text-[rgb(var(--color-text-secondary))]">الحزم المتاحة: {c.packagesCount}</div>
                  </div>
                  <button onClick={()=>handleActivate(c.id)} disabled={busy}
                    className="px-3 py-1.5 rounded-md text-xs md:text-sm bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-hover))] text-[rgb(var(--color-primary-contrast))] disabled:opacity-50">{busy?'...جارٍ':'تفعيل'}</button>
                </div>
              ); })}
            </div>
            <div className="px-4 py-3 border-t border-[rgb(var(--color-border))] flex justify-end">
              <button onClick={()=>setShowCatalogModal(false)} className="px-4 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-800 text-sm text-white">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
