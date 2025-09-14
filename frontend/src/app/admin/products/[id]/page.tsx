"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_ROUTES } from '@/utils/api';
import { ErrorResponse } from '@/types/common';
import { getDecimalDigits, priceInputStep, clampPriceDecimals } from '@/utils/pricingFormat';

// ===== Types =====
interface ProductPackage {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  publicCode?: number | null;
  type?: 'fixed' | 'unit';
  unitName?: string | null;
  unitCode?: string | null;
  minUnits?: number | null;
  maxUnits?: number | null;
  step?: number | null;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  customImageUrl?: string | null;
  useCatalogImage?: boolean;
  imageSource?: 'catalog' | 'custom' | null;
  hasCustomImage?: boolean;
  catalogAltText?: string | null;
  customAltText?: string | null;
  isActive: boolean;
  supportsCounter?: boolean;
  packages?: ProductPackage[];
}

// ===== Helpers =====
async function uploadToCloudinary(file: File, token: string, apiBase: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/admin/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  } catch {
    throw new Error('تعذر الاتصال بالخادم أثناء الرفع');
  }
  if (res.status !== 200 && res.status !== 201) {
    if (res.status === 401 || res.status === 403) throw new Error('جلسة منتهية، يرجى تسجيل الدخول');
    if (res.status === 413) throw new Error('الصورة كبيرة جدًا');
    let payload: any = null; try { payload = await res.json(); } catch {}
    const msg = String(payload?.message || payload?.error || '');
    if (/cloudinary/i.test(msg) && /غير صحيحة|bad credential|cloudinary/i.test(msg)) throw new Error('إعدادات Cloudinary غير صحيحة');
    if (payload?.code === 'file_too_large') throw new Error('الصورة كبيرة جدًا');
    if (payload?.code === 'cloudinary_bad_credentials') throw new Error('إعدادات Cloudinary غير صحيحة');
    throw new Error(msg || 'فشل رفع الملف…');
  }
  const data = await res.json().catch(() => ({} as any));
  const url: string | undefined = data?.url || data?.secure_url || data?.imageUrl || data?.data?.url || data?.data?.secure_url || data?.data?.imageUrl;
  if (!url) throw new Error('لم يتم استلام رابط الصورة');
  return url;
}

// ===== Page Component =====
export default function AdminProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  // Core product state
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form fields
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [editUseCatalog, setEditUseCatalog] = useState<boolean>(false);
  const [editCatalogAlt, setEditCatalogAlt] = useState('');
  const [editCustomAlt, setEditCustomAlt] = useState('');
  const [editSupportsCounter, setEditSupportsCounter] = useState<boolean>(false);


  // Package creation form
  const [pkgName, setPkgName] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgPrice, setPkgPrice] = useState<number>(0);
  const [pkgBridge, setPkgBridge] = useState('');
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgType, setPkgType] = useState<'fixed' | 'unit'>('fixed');
  const [pkgUnitName, setPkgUnitName] = useState('');
  // removed baseUnitPrice (pricing now derived exclusively from price group rows)

  // Bridges
  const [bridges, setBridges] = useState<(number | string)[]>([]);
  const [bridgesLoading, setBridgesLoading] = useState(false);

  // Tabs
  // Removed separate unit tab (only one unit package allowed now)
  const [activeTab] = useState<'basic'>('basic');
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitModalPkg, setUnitModalPkg] = useState<ProductPackage | null>(null);
  const [unitForm, setUnitForm] = useState({ unitName: '', unitCode: '', minUnits: '', maxUnits: '', step: '' });
  const [unitSaving, setUnitSaving] = useState(false);
  const DECIMAL_DIGITS = getDecimalDigits();

  const apiHost = API_ROUTES.products.base.replace('/api/products', '');
  const apiBase = `${apiHost}/api`;

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.base}/${id}?all=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('فشل في جلب بيانات المنتج');
      const data: Product = await res.json();
      setProduct(data);
      setEditName(data.name);
      setEditDesc(data.description || '');
      setEditActive(data.isActive);
      setEditUseCatalog(Boolean(data.useCatalogImage));
      setEditCatalogAlt(data.catalogAltText || '');
      setEditCustomAlt(data.customAltText || '');
  setEditSupportsCounter(Boolean(data.supportsCounter));
    } catch (e: any) {
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchBridges = useCallback(async () => {
    if (!id) return;
    try {
      setBridgesLoading(true);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.base}/${id}/bridges`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw: any[] = Array.isArray(data.available) ? data.available : [];
      const cleaned = raw
        .map((v: any) => {
          if (v == null) return null;
          if (typeof v === 'number' || typeof v === 'string') return v;
          if (typeof v === 'object') return (v.code ?? v.value ?? null);
          return null;
        })
        .filter((v: any) => v !== null && v !== '' && !Number.isNaN(Number(v))) as (number | string)[];
      const unique = Array.from(new Set(cleaned.map(v => String(v)))).map(s => (/^\d+$/.test(s) ? Number(s) : s)).sort((a, b) => Number(a) - Number(b));
      setBridges(unique);
    } catch {
      setBridges([]);
    } finally {
      setBridgesLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProduct(); fetchBridges(); }, [fetchProduct, fetchBridges]);

  const handleUpdateProduct = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      if (!token) throw new Error('الرجاء تسجيل الدخول كمسؤول.');
      let imageUrl = product?.imageUrl;
      let customImageUrl = product?.customImageUrl ?? null;
      let useCatalogImage = editUseCatalog;
      if (editImage) {
        const uploaded = await uploadToCloudinary(editImage, token, apiBase);
        customImageUrl = uploaded;
        imageUrl = uploaded;
        useCatalogImage = false;
      }
      const updateRes = await fetch(`${API_ROUTES.products.base}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          imageUrl,
          customImageUrl,
          useCatalogImage,
          catalogAltText: editCatalogAlt || null,
            customAltText: editCustomAlt || null,
          isActive: editActive,

        })
      });
      if (!updateRes.ok) throw new Error('فشل في تعديل المنتج');
      setEditImage(null);
      await fetchProduct();
      alert('تم حفظ التغييرات بنجاح');
    } catch (e: any) { alert(e.message || 'حدث خطأ غير متوقع'); }
  };

  const handleDeleteProduct = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.base}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('فشل في حذف المنتج');
      router.push('/admin/products');
    } catch (e: any) { alert(e.message || 'حدث خطأ غير متوقع'); }
  };

  const handleAddPackage = async () => {
    if (!pkgName) return alert('يرجى إدخال اسم الباقة');
    if (!pkgBridge) return alert('يرجى اختيار الجسر');
    if (pkgType === 'unit' && !editSupportsCounter) {
      return alert('فعّل نمط العداد أولاً ثم أضف باقة من نوع unit');
    }
    if (pkgType === 'unit') {
      if (!pkgUnitName.trim()) return alert('أدخل اسم الوحدة');
    }
    try {
      const token = localStorage.getItem('token') || '';
      const payload: any = { name: pkgName, description: pkgDesc, basePrice: pkgPrice, publicCode: pkgBridge, isActive: true, type: pkgType };
      if (pkgType === 'unit') {
        payload.unitName = pkgUnitName.trim();
      }
      // NOTE: backend does NOT expose POST /admin/products/:id/packages (404). Use products controller route instead.
      const res = await fetch(`${API_ROUTES.products.base}/${id}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, publicCode: pkgBridge })
      });
      if (!res.ok) throw new Error('فشل في إضافة الباقة');
  setPkgName(''); setPkgDesc(''); setPkgPrice(0); setPkgBridge(''); setShowPackageForm(false); setPkgType('fixed'); setPkgUnitName('');
      fetchProduct(); fetchBridges();
    } catch (e: any) { alert(e.message || 'حدث خطأ غير متوقع'); }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    try {
      const token = localStorage.getItem('token') || '';
      await fetch(`${API_ROUTES.products.base}/packages/${pkgId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchProduct();
    } catch (e: any) { alert(e.message || 'حدث خطأ غير متوقع'); }
  };

  if (loading) return <p className="p-4 text-text-primary">جاري التحميل...</p>;
  if (error) return <p className="p-4 text-danger">{error}</p>;
  if (!product) return <p className="p-4 text-text-secondary">المنتج غير موجود</p>;

  const unitPackages = (product.packages || []).filter(p => p.type === 'unit');
  const unitExists = unitPackages.length > 0;

  function openUnitModal(pkg: ProductPackage) {
    setUnitModalPkg(pkg);
    setUnitForm({
      unitName: pkg.unitName ? String(pkg.unitName) : '',
      unitCode: pkg.unitCode ? String(pkg.unitCode) : '',
      minUnits: pkg.minUnits != null ? String(pkg.minUnits) : '',
      maxUnits: pkg.maxUnits != null ? String(pkg.maxUnits) : '',
      step: pkg.step != null ? String(pkg.step) : '',
    });
    setShowUnitModal(true);
  }

  async function saveUnitModal() {
    if (!unitModalPkg) return;
    if (!unitForm.unitName.trim()) { alert('اسم الوحدة مطلوب'); return; }
    const min = unitForm.minUnits.trim() ? Number(unitForm.minUnits) : null;
    const max = unitForm.maxUnits.trim() ? Number(unitForm.maxUnits) : null;
    if (min != null && max != null && max < min) { alert('الحد الأقصى يجب أن يكون أكبر أو يساوي الحد الأدنى'); return; }
    const stepNum = unitForm.step.trim() ? Number(unitForm.step) : null;
    if (stepNum != null && stepNum <= 0) { alert('Step يجب أن يكون > 0'); return; }
    setUnitSaving(true);
    try {
      const token = localStorage.getItem('token') || '';
      const body: any = {
        unitName: unitForm.unitName.trim(),
        unitCode: unitForm.unitCode.trim() || null,
        minUnits: unitForm.minUnits.trim() || null,
        maxUnits: unitForm.maxUnits.trim() || null,
        step: unitForm.step.trim() || null,
      };
  const res = await fetch(`/api/admin/products/packages/${unitModalPkg.id}/unit`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) { let payload: any = null; try { payload = await res.json(); } catch {} throw new Error(payload?.message || 'فشل الحفظ'); }
      // Optimistic local update
  setProduct(prev => prev ? ({ ...prev, packages: (prev.packages||[]).map(p => p.id === unitModalPkg.id ? { ...p, unitName: body.unitName, unitCode: body.unitCode, minUnits: min, maxUnits: max, step: stepNum } : p) }) : prev);
      setShowUnitModal(false);
    } catch (e: any) { alert(e.message || 'خطأ'); }
    finally { setUnitSaving(false); }
  }

  const imgSrc = product.imageUrl
    ? (product.imageUrl.startsWith('http')
      ? product.imageUrl
      : product.imageUrl.startsWith('/')
        ? `${apiHost}${product.imageUrl}`
        : `${apiHost}/${product.imageUrl}`)
    : null;

  const imageSource: 'catalog' | 'custom' | 'none' = product.imageSource
    ? product.imageSource
    : product.imageUrl
      ? (product.useCatalogImage ? 'catalog' : 'custom')
      : 'none';
  const sourceLabelMap = { catalog: 'Catalog', custom: 'Custom', none: 'None' } as const;
  const badgeColor = imageSource === 'catalog' ? 'bg-blue-600' : imageSource === 'custom' ? 'bg-emerald-600' : 'bg-gray-400';

  return (
    <div className="p-6 bg-bg-surface rounded shadow max-w-3xl mx-auto text-text-primary border border-border">
      <div className="mb-4" />
      {
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">المنتج: {product.name}</h1>
            <div className="flex gap-2">
              <button onClick={handleUpdateProduct} className="px-4 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover">حفظ التغييرات</button>
              <button onClick={handleDeleteProduct} className="px-4 py-2 bg-danger text-text-inverse rounded hover:brightness-110">حذف المنتج</button>
            </div>
          </div>

          <input className="w-full border border-border p-2 rounded mb-2 bg-bg-surface-alt text-text-primary" value={editName} onChange={e => setEditName(e.target.value)} placeholder="اسم المنتج" />
          <textarea className="w-full border border-border p-2 rounded mb-2 bg-bg-surface-alt text-text-primary" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="الوصف" />

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[12px] text-text-secondary mb-1">نص بديل (كتالوج)</label>
              <input className="w-full border border-border p-2 rounded bg-bg-surface-alt text-text-primary" value={editCatalogAlt} onChange={e => setEditCatalogAlt(e.target.value)} placeholder="مثال: بطاقة هدايا متجر X" />
            </div>
            <div>
              <label className="block text-[12px] text-text-secondary mb-1">نص بديل (مخصص)</label>
              <input className="w-full border border-border p-2 rounded bg-bg-surface-alt text-text-primary" value={editCustomAlt} onChange={e => setEditCustomAlt(e.target.value)} placeholder="وصف دقيق للصورة المخصصة" />
            </div>
          </div>

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${badgeColor}`}>{sourceLabelMap[imageSource]}</span>
                {imageSource !== 'none' && (<span className="text-[11px] text-text-secondary">(المصدر الحالي)</span>)}
              </div>
              <label className="flex items-center gap-2 text-text-secondary">
                <input type="checkbox" checked={editUseCatalog} onChange={e => setEditUseCatalog(e.target.checked)} />
                استخدم صورة الكتالوج
              </label>
              <div>
                <label className="block text-[12px] text-text-secondary mb-1">صورة مخصصة (تجاوز)</label>
                <input type="file" accept="image/*" onChange={e => e.target.files && setEditImage(e.target.files[0])} className="text-text-secondary max-w-xs" disabled={editUseCatalog} />
                {editUseCatalog && (<div className="text-[11px] mt-1 text-text-secondary">إلغاء التحديد لتفعيل الرفع المخصص</div>)}
              </div>
            </div>

            <label className="flex items-center gap-2 mb-4 text-text-secondary">
              <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
              فعال؟
            </label>

            <label className="flex items-center gap-2 mb-4 text-text-secondary">
              <input
                type="checkbox"
                checked={editSupportsCounter}
                onChange={async e => {
                  const next = e.target.checked;
                  setEditSupportsCounter(next);
                  try {
                    const token = localStorage.getItem('token') || '';
                    const res = await fetch(`/api/admin/products/${id}/supports-counter`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ supportsCounter: next }) });
                    if (!res.ok) throw new Error('فشل تحديث نمط العداد');
                  } catch (err:any) {
                    alert(err.message || 'تعذر تحديث نمط العداد');
                    setEditSupportsCounter(!next);
                  }
                }}
              />
              تفعيل نمط العداد (الوحدة)
            </label>
              {editSupportsCounter && unitPackages.length === 0 && (
                <div className="text-[11px] text-amber-500 mb-4 leading-relaxed">
                  لتفعيل تبويب <span className="font-semibold">إعدادات العداد</span>:
                  <br />
                  1- أضف باقة جديدة أو عدّل باقة موجودة واجعل نوعها <span className="font-mono bg-bg-surface-alt px-1 rounded border border-border">unit</span>.
                  <br />
                  2- أدخل اسم الوحدة (مثال: رسالة، نقطة، دقيقة).
                  <br />
                  بعد حفظ الباقة ستظهر لك تبويب إعدادات العداد لإدارة الحد الأدنى والأقصى و قيمة الخطوة (Step) وأسعار المجموعات.
                </div>
              )}

            <div className="mb-6">
              {imgSrc ? (
                <div className="relative inline-block">
                  <img src={imgSrc} alt={product.name} width={80} height={80} className="w-20 h-20 object-cover rounded border border-border shadow" onError={(e: any) => { e.currentTarget.src = '/images/placeholder.png'; }} loading="lazy" />
                  <span className={`absolute -top-2 -right-2 ${badgeColor} text-white text-[10px] px-1.5 py-0.5 rounded-full shadow`}>{sourceLabelMap[imageSource]}</span>
                </div>
              ) : (
                <div className="w-20 h-20 rounded border border-dashed border-border flex items-center justify-center text-text-secondary text-xs">لا توجد صورة</div>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">الباقات</h2>
              <button onClick={() => setShowPackageForm(p => !p)} className="px-3 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover text-sm">{showPackageForm ? 'إغلاق النموذج' : '+ إضافة باقة جديدة'}</button>
            </div>
            {product.packages && product.packages.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded mb-4">
                <table className="min-w-full text-sm">
                  <thead className="bg-bg-surface-alt text-text-secondary text-xs">
                    <tr>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-right">النوع</th>
                      <th className="p-2 text-right">الكود / الجسر</th>
                      <th className="p-2 text-right">الوصف</th>
                      <th className="p-2 text-right">رأس المال</th>
                      <th className="p-2 text-right">الحالة</th>
                      <th className="p-2 text-right">إعدادات العداد</th>
                      <th className="p-2 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.packages.map(pkg => (
                      <PackageRow
                        key={pkg.id}
                        pkg={pkg}
                        allPackages={product.packages || []}
                        availableBridges={bridges}
                        onChanged={() => { fetchProduct(); fetchBridges(); }}
                        onDelete={() => handleDeletePackage(pkg.id)}
                        onOpenUnit={() => openUnitModal(pkg)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-secondary mb-4">لا توجد باقات</p>
            )}

            {showPackageForm && (
              <div className="border border-border rounded p-4 mb-4 bg-bg-surface-alt space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-text-secondary mb-1">نوع الباقة</label>
                    <select className="w-full border border-border rounded p-2 bg-bg-surface text-text-primary" value={pkgType} onChange={e => setPkgType(e.target.value as any)}>
                      <option value="fixed">Fixed (ثابت)</option>
                      <option value="unit" disabled={unitExists}>Unit (عداد)</option>
                    </select>
                    {unitExists && <div className="text-[10px] mt-1 text-text-secondary">هناك باقة عداد واحدة بالفعل</div>}
                  </div>
                  <div>
                    <label className="block text-[12px] text-text-secondary mb-1">اسم الباقة</label>
                    <input className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary" value={pkgName} onChange={e => setPkgName(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[12px] text-text-secondary mb-1">الوصف (اختياري)</label>
                    <textarea className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary" value={pkgDesc} onChange={e => setPkgDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-text-secondary mb-1">رأس المال (يمكن أن يكون صفراً)</label>
                    <input type="number" className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary" value={pkgPrice} onChange={e => setPkgPrice(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-text-secondary mb-1">الجسر (مطلوب)</label>
                    <select className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary" value={pkgBridge} onChange={e => setPkgBridge(e.target.value)}>
                      <option value="">-- اختر الجسر --</option>
                      {bridges.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  {pkgType === 'unit' && !unitExists && (
                    <div>
                      <label className="block text-[12px] text-text-secondary mb-1">اسم الوحدة (مثال: نقطة، رسالة)</label>
                      <input className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary" value={pkgUnitName} onChange={e => setPkgUnitName(e.target.value)} />
                    </div>
                  )}
                </div>
                {pkgType === 'unit' && !editSupportsCounter && !unitExists && (
                  <div className="text-[11px] text-amber-500">فعّل نمط العداد أولاً من أعلى الصفحة قبل إنشاء باقة وحدة.</div>
                )}
                {pkgType === 'unit' && unitExists && (
                  <div className="text-[11px] text-text-secondary">لا يمكن إنشاء أكثر من باقة عداد واحدة.</div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleAddPackage} className="px-4 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover">حفظ الباقة</button>
                </div>
              </div>
            )}
            {/* Unit Settings Modal */}
            {showUnitModal && unitModalPkg && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-bg-surface rounded shadow-lg w-full max-w-md border border-border p-4 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-lg">إعدادات العداد: {unitModalPkg.name}</h3>
                    <button onClick={() => setShowUnitModal(false)} className="text-text-secondary hover:text-text-primary text-sm">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] text-text-secondary mb-1">اسم الوحدة (مطلوب)</label>
                      <input className="w-full border border-border rounded p-2 bg-bg-surface-alt" value={unitForm.unitName} onChange={e => setUnitForm(f => ({ ...f, unitName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-secondary mb-1">رمز (اختياري)</label>
                      <input className="w-full border border-border rounded p-2 bg-bg-surface-alt" value={unitForm.unitCode} onChange={e => setUnitForm(f => ({ ...f, unitCode: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-secondary mb-1">الحد الأدنى (اختياري)</label>
                      <input type="number" className="w-full border border-border rounded p-2 bg-bg-surface-alt" value={unitForm.minUnits} onChange={e => setUnitForm(f => ({ ...f, minUnits: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-secondary mb-1">الحد الأقصى (اختياري)</label>
                      <input type="number" className="w-full border border-border rounded p-2 bg-bg-surface-alt" value={unitForm.maxUnits} onChange={e => setUnitForm(f => ({ ...f, maxUnits: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-secondary mb-1">Step (اختياري)</label>
                      <input type="number" className="w-full border border-border rounded p-2 bg-bg-surface-alt" value={unitForm.step} onChange={e => setUnitForm(f => ({ ...f, step: e.target.value }))} />
                    </div>
                  </div>
                  <div className="text-[10px] text-text-secondary leading-relaxed">اترك الحقول الفارغة لإلغاء التقييد. يجب أن يكون سعر الوحدة &gt; 0. ويجب أن يكون الحد الأقصى ≥ الحد الأدنى إن تم تعبئتهما.</div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowUnitModal(false)} className="px-3 py-1.5 rounded bg-gray-600 text-text-inverse text-sm">إلغاء</button>
                    <button disabled={unitSaving} onClick={saveUnitModal} className="px-4 py-1.5 rounded bg-primary text-primary-contrast text-sm disabled:opacity-50">{unitSaving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
                  </div>
                </div>
              </div>
            )}
        </>
      }
    </div>
  );
}

// ===== Package Row (basic tab) =====
function PackageRow({ pkg, allPackages, availableBridges, onChanged, onDelete, onOpenUnit }: { pkg: ProductPackage; allPackages: ProductPackage[]; availableBridges: (number|string)[]; onChanged: () => void; onDelete: () => void; onOpenUnit: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pkg.name);
  const [desc, setDesc] = useState(pkg.description || '');
  const [basePrice, setBasePrice] = useState<number>(pkg.basePrice);
  const [isActive, setIsActive] = useState<boolean>(pkg.isActive);
  const [codeOptions, setCodeOptions] = useState<number[]>([]);
  const [code, setCode] = useState<string>(pkg.publicCode ? String(pkg.publicCode) : '');
  const [saving, setSaving] = useState(false);
  const token = (typeof window !== 'undefined') ? localStorage.getItem('token') || '' : '';

  useEffect(() => {
    const current = (pkg.publicCode != null && (typeof pkg.publicCode === 'number' || typeof pkg.publicCode === 'string')) ? [pkg.publicCode] : [];
    const merged = [...current, ...availableBridges];
    const numeric = merged
      .map(v => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v))
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    const union = Array.from(new Set(numeric)).sort((a, b) => a - b);
    setCodeOptions(union);
  }, [allPackages.map(p => p.publicCode).join(','), availableBridges.join(','), pkg.publicCode]);

  const saveBasic = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/basic`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, description: desc || null, basePrice, isActive }) });
      if (!res.ok) throw new Error('فشل حفظ التعديلات');
      if ((code || '').trim() !== String(pkg.publicCode || '')) {
        const r2 = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/code`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ publicCode: code ? Number(code) : null }) });
        if (!r2.ok) throw new Error('تم حفظ الباقة لكن فشل تحديث الكود');
      }
      setEditing(false); onChanged();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <tr className={`border-t border-border ${pkg.type === 'unit' ? 'bg-violet-950/20' : ''}`}>
      <td className="p-2 align-top font-medium flex flex-col gap-1">
        {editing ? (
          <input className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" value={name} onChange={e => setName(e.target.value)} />
        ) : (
          <span>{pkg.name}</span>
        )}
      </td>
      <td className="p-2 align-top text-xs">{pkg.type === 'unit' ? <span className="inline-block px-2 py-0.5 rounded-full bg-violet-600 text-white">Unit</span> : <span className="inline-block px-2 py-0.5 rounded-full bg-slate-600 text-white">Fixed</span>}</td>
      <td className="p-2 align-top">{editing ? (<select className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" value={code} onChange={e => setCode(e.target.value)}><option value="">اختر</option>{codeOptions.map(c => (<option key={c} value={c}>{c}</option>))}</select>) : (pkg.publicCode ? <span>{pkg.publicCode}</span> : <span className="text-text-secondary">—</span>)}</td>
      <td className="p-2 align-top max-w-[200px]">{editing ? (<textarea className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" rows={2} value={desc} onChange={e => setDesc(e.target.value)} />) : (pkg.description ? (<span title={pkg.description} className="line-clamp-2 whitespace-pre-wrap text-[12px] text-text-secondary">{pkg.description}</span>) : <span className="text-text-secondary">—</span>)}</td>
      <td className="p-2 align-top">{editing ? (<input type="number" className="w-24 text-sm p-1 rounded bg-bg-surface-alt border border-border" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))} />) : (<span>{pkg.basePrice}</span>)}</td>
      <td className="p-2 align-top">{editing ? (<label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /><span>{isActive ? 'فعال' : 'متوقف'}</span></label>) : (<span className={`text-xs px-2 py-1 rounded-full ${pkg.isActive ? 'bg-emerald-600/20 text-emerald-500' : 'bg-gray-600/30 text-gray-400'}`}>{pkg.isActive ? 'فعال' : 'متوقف'}</span>)}</td>
      <td className="p-2 align-top text-center">
        {pkg.type === 'unit' ? (
          <button onClick={onOpenUnit} className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs">⚙</button>
        ) : <span className="text-text-secondary text-xs">—</span>}
      </td>
      <td className="p-2 align-top flex gap-2 flex-wrap">
        {editing ? (
          <>
            <button disabled={saving} onClick={saveBasic} className="px-2 py-1 bg-success text-text-inverse rounded text-xs disabled:opacity-50">حفظ</button>
            <button disabled={saving} onClick={() => { setEditing(false); setName(pkg.name); setDesc(pkg.description || ''); setBasePrice(pkg.basePrice); setIsActive(pkg.isActive); setCode(pkg.publicCode ? String(pkg.publicCode) : ''); }} className="px-2 py-1 bg-gray-600 text-text-inverse rounded text-xs">إلغاء</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="px-2 py-1 bg-primary text-primary-contrast rounded text-xs">تعديل</button>
            <button onClick={onDelete} className="px-2 py-1 bg-danger text-text-inverse rounded text-xs">حذف</button>
          </>
        )}
      </td>
    </tr>
  );
}

// ===== Unit Modal Logic =====
// (openUnitModal defined inside component above)

