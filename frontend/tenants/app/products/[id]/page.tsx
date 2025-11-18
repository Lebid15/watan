"use client";

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useRouter } from 'next/navigation';
import { API_ROUTES, API_BASE_URL } from '@/utils/api';
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
async function uploadToCloudinary(file: File, token: string, apiBase: string, t: any): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/admin/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  } catch {
    throw new Error(t('errors.upload.network'));
  }
  if (res.status !== 200 && res.status !== 201) {
  if (res.status === 401 || res.status === 403) throw new Error(t('errors.session.expired'));
  if (res.status === 413) throw new Error(t('errors.image.tooLarge'));
    let payload: any = null; try { payload = await res.json(); } catch {}
    const msg = String(payload?.message || payload?.error || '');
  if (/cloudinary/i.test(msg) && /غير صحيحة|bad credential|cloudinary/i.test(msg)) throw new Error(t('errors.cloudinary.badConfig'));
  if (payload?.code === 'file_too_large') throw new Error(t('errors.image.tooLarge'));
  if (payload?.code === 'cloudinary_bad_credentials') throw new Error(t('errors.cloudinary.badConfig'));
  throw new Error(msg || t('errors.upload.generic'));
  }
  const data = await res.json().catch(() => ({} as any));
  const url: string | undefined = data?.url || data?.secure_url || data?.imageUrl || data?.data?.url || data?.data?.secure_url || data?.data?.imageUrl;
  if (!url) throw new Error(t('errors.image.missingUrl'));
  return url;
}

// ===== Page Component =====
export default function AdminProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useTranslation();

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
  const [activeTab, setActiveTab] = useState<'packages' | 'edit'>('packages');
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitModalPkg, setUnitModalPkg] = useState<ProductPackage | null>(null);
  const [unitForm, setUnitForm] = useState({ unitName: '', unitCode: '', minUnits: '', maxUnits: '', step: '' });
  const [unitSaving, setUnitSaving] = useState(false);
  const DECIMAL_DIGITS = getDecimalDigits();

  // Use configured API base directly
  const apiBase = API_BASE_URL;

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Mock data for development
      const mockProduct: Product = {
        id: String(id),
        name: 'PUBG Mobile',
        description: 'بطاقة شحن UC لببجي موبايل',
        imageUrl: '/images/placeholder.png',
        isActive: true,
        supportsCounter: false,
        packages: [
          {
            id: '1',
            name: 'PUBG 60 UC',
            description: 'شحن 60 UC',
            basePrice: 5.50,
            isActive: true,
            publicCode: 1001,
            type: 'fixed',
          },
          {
            id: '2',
            name: 'PUBG 325 UC',
            description: 'شحن 325 UC',
            basePrice: 25.00,
            isActive: true,
            publicCode: 1002,
            type: 'fixed',
          },
          {
            id: '3',
            name: 'PUBG 660 UC',
            description: 'شحن 660 UC',
            basePrice: 50.00,
            isActive: true,
            publicCode: 1003,
            type: 'fixed',
          },
        ],
      };

      setProduct(mockProduct);
      setEditName(mockProduct.name);
      setEditDesc(mockProduct.description || '');
      setEditActive(mockProduct.isActive);
      setEditUseCatalog(Boolean(mockProduct.useCatalogImage));
      setEditCatalogAlt(mockProduct.catalogAltText || '');
      setEditCustomAlt(mockProduct.customAltText || '');
      setEditSupportsCounter(Boolean(mockProduct.supportsCounter));

      // Original API call (commented out for mock)
      /*
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.byId(String(id))}?all=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(t('errors.product.fetchFailed'));
      const data: Product = await res.json();
      setProduct(data);
      setEditName(data.name);
      setEditDesc(data.description || '');
      setEditActive(data.isActive);
      setEditUseCatalog(Boolean(data.useCatalogImage));
      setEditCatalogAlt(data.catalogAltText || '');
      setEditCustomAlt(data.customAltText || '');
      setEditSupportsCounter(Boolean(data.supportsCounter));
      */
    } catch (e: any) {
      setError(e.message || t('errors.unexpected'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchBridges = useCallback(async () => {
    if (!id) return;
    try {
      setBridgesLoading(true);
      
      // Mock bridges data
      const mockBridges = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010];
      setBridges(mockBridges);

      // Original API call (commented out for mock)
      /*
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.byId(String(id))}/bridges`, { headers: { Authorization: `Bearer ${token}` } });
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
      */
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
  if (!token) throw new Error(t('auth.admin.loginRequired'));
      let imageUrl = product?.imageUrl;
      let customImageUrl = product?.customImageUrl ?? null;
      let useCatalogImage = editUseCatalog;
      if (editImage) {
  const uploaded = await uploadToCloudinary(editImage, token, apiBase, t);
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
  if (!updateRes.ok) throw new Error(t('product.save.fail'));
      setEditImage(null);
      await fetchProduct();
      alert(t('product.save.success'));
    } catch (e: any) { alert(e.message || t('errors.unexpected')); }
  };

  const handleDeleteProduct = async () => {
  if (!confirm(t('product.delete.confirm'))) return;
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.base}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let serverMsg = '';
        try {
          const data = await res.json();
          const code = data?.code || data?.error || data?.statusCode;
          const msg = data?.message;
          if (typeof msg === 'string') serverMsg = msg;
          else if (Array.isArray(msg)) serverMsg = msg.join(', ');
          if (code && !serverMsg) serverMsg = String(code);
          if (code && serverMsg) serverMsg = `${serverMsg} (code: ${code})`;
        } catch {}
        throw new Error(serverMsg || t('product.delete.fail'));
      }
      router.push('/products');
  } catch (e: any) { alert(e.message || t('errors.unexpected')); }
  };

  const handleAddPackage = async () => {
    if (!pkgName) return alert('اسم الباقة مطلوب');
    if (!pkgBridge) return alert('رقم الربط مطلوب');

    try {
      // Mock: Add package locally
      const newPackage: ProductPackage = {
        id: String(Date.now()),
        name: pkgName,
        description: pkgDesc,
        basePrice: pkgPrice,
        publicCode: Number(pkgBridge),
        isActive: true,
        type: pkgType,
      };

      setProduct((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          packages: [...(prev.packages || []), newPackage],
        };
      });

      setPkgName('');
      setPkgDesc('');
      setPkgPrice(0);
      setPkgBridge('');
      setShowPackageForm(false);
      setPkgType('fixed');
      setPkgUnitName('');

      alert('تم إضافة الباقة بنجاح (وضع تجريبي)');

      // Original API call (commented out for mock)
      /*
      const token = localStorage.getItem('token') || '';
      const payload: any = { name: pkgName, description: pkgDesc, basePrice: pkgPrice, publicCode: pkgBridge, isActive: true, type: pkgType };
      if (pkgType === 'unit') {
        payload.unitName = pkgUnitName.trim();
      }
      const res = await fetch(`${API_ROUTES.products.base}/${id}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, publicCode: pkgBridge })
      });
      if (!res.ok) throw new Error(t('package.add.fail'));
      setPkgName(''); setPkgDesc(''); setPkgPrice(0); setPkgBridge(''); setShowPackageForm(false); setPkgType('fixed'); setPkgUnitName('');
      fetchProduct(); fetchBridges();
      */
    } catch (e: any) {
      alert(e.message || 'حدث خطأ');
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    try {
      // Mock: Remove package locally
      setProduct((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          packages: (prev.packages || []).filter((p) => p.id !== pkgId),
        };
      });

      alert('تم حذف الباقة بنجاح (وضع تجريبي)');

      // Original API call (commented out for mock)
      /*
      const token = localStorage.getItem('token') || '';
      await fetch(`${API_ROUTES.products.base}/packages/${pkgId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchProduct();
      */
    } catch (e: any) {
      alert(e.message || 'حدث خطأ');
    }
  };

  if (loading) return <p className="p-4 text-text-primary">{t('product.status.loading')}</p>;
  if (error) return <p className="p-4 text-danger">{error}</p>;
  if (!product) return <p className="p-4 text-text-secondary">{t('product.notFound')}</p>;

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
  if (!unitForm.unitName.trim()) { alert(t('unit.name.required')); return; }
    const min = unitForm.minUnits.trim() ? Number(unitForm.minUnits) : null;
    const max = unitForm.maxUnits.trim() ? Number(unitForm.maxUnits) : null;
  if (min != null && max != null && max < min) { alert(t('unit.limit.rangeInvalid')); return; }
    const stepNum = unitForm.step.trim() ? Number(unitForm.step) : null;
  if (stepNum != null && stepNum <= 0) { alert(t('unit.step.invalid')); return; }
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
  const res = await fetch(`${API_BASE_URL}/admin/products/packages/${unitModalPkg.id}/unit`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) { let payload: any = null; try { payload = await res.json(); } catch {} throw new Error(payload?.message || t('unit.save.fail')); }
      // Optimistic local update
  setProduct(prev => prev ? ({ ...prev, packages: (prev.packages||[]).map(p => p.id === unitModalPkg.id ? { ...p, unitName: body.unitName, unitCode: body.unitCode, minUnits: min, maxUnits: max, step: stepNum } : p) }) : prev);
      setShowUnitModal(false);
  } catch (e: any) { alert(e.message || t('generic.error.short')); }
    finally { setUnitSaving(false); }
  }

  const imgSrc = product.imageUrl
    ? (product.imageUrl.startsWith('http')
      ? product.imageUrl
      : product.imageUrl.startsWith('/images/')
        ? product.imageUrl // Use local path directly without API_BASE_URL
        : (() => {
          try {
            const origin = typeof window !== 'undefined'
              ? new URL(API_BASE_URL, window.location.origin).origin
              : '';
            if (product.imageUrl!.startsWith('/')) return `${origin}${product.imageUrl}`;
            return `${origin}/${product.imageUrl}`;
          } catch { return product.imageUrl as string; }
        })())
    : null;

  const imageSource: 'catalog' | 'custom' | 'none' = product.imageSource
    ? product.imageSource
    : product.imageUrl
      ? (product.useCatalogImage ? 'catalog' : 'custom')
      : 'none';
  const sourceLabelMap = { catalog: 'Catalog', custom: 'Custom', none: 'None' } as const;
  const badgeColor = imageSource === 'catalog' ? 'bg-blue-600' : imageSource === 'custom' ? 'bg-emerald-600' : 'bg-gray-400';

  return (
    <div className="p-6 bg-bg-base min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 bg-bg-surface p-6 rounded-lg shadow border border-border">
          <h1 className="text-xl font-bold text-text-primary">إدارة المنتج والباقات</h1>
        </div>

        {/* Tabs Header */}
        <div className="bg-bg-surface rounded-t-lg border-b border-border shadow">
          <div className="flex gap-1 px-4">
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-6 py-3 font-medium text-sm transition-all relative ${
                activeTab === 'packages'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              الباقات
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-6 py-3 font-medium text-sm transition-all relative ${
                activeTab === 'edit'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              تعديل المنتج
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-bg-surface rounded-b-lg shadow border border-border border-t-0 p-6">
          {activeTab === 'packages' && (
            <PackagesTab
              product={product}
              bridges={bridges}
              bridgesLoading={bridgesLoading}
              showPackageForm={showPackageForm}
              setShowPackageForm={setShowPackageForm}
              pkgName={pkgName}
              setPkgName={setPkgName}
              pkgDesc={pkgDesc}
              setPkgDesc={setPkgDesc}
              pkgPrice={pkgPrice}
              setPkgPrice={setPkgPrice}
              pkgBridge={pkgBridge}
              setPkgBridge={setPkgBridge}
              pkgType={pkgType}
              setPkgType={setPkgType}
              pkgUnitName={pkgUnitName}
              setPkgUnitName={setPkgUnitName}
              editSupportsCounter={editSupportsCounter}
              handleAddPackage={handleAddPackage}
              handleDeletePackage={handleDeletePackage}
              fetchProduct={fetchProduct}
              fetchBridges={fetchBridges}
              onOpenUnit={openUnitModal}
            />
          )}

          {activeTab === 'edit' && (
            <EditProductTab
              product={product}
              imgSrc={imgSrc}
              imageSource={imageSource}
              editName={editName}
              setEditName={setEditName}
              editActive={editActive}
              setEditActive={setEditActive}
              editSupportsCounter={editSupportsCounter}
              setEditSupportsCounter={setEditSupportsCounter}
              handleUpdateProduct={handleUpdateProduct}
              id={id as string}
              t={t}
            />
          )}
        </div>

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
      </div>
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

// ===== Packages Tab Component =====
function PackagesTab({
  product,
  bridges,
  bridgesLoading,
  showPackageForm,
  setShowPackageForm,
  pkgName,
  setPkgName,
  pkgDesc,
  setPkgDesc,
  pkgPrice,
  setPkgPrice,
  pkgBridge,
  setPkgBridge,
  pkgType,
  setPkgType,
  pkgUnitName,
  setPkgUnitName,
  editSupportsCounter,
  handleAddPackage,
  handleDeletePackage,
  fetchProduct,
  fetchBridges,
  onOpenUnit,
}: any) {
  const unitPackages = (product.packages || []).filter((p: any) => p.type === 'unit');
  const unitExists = unitPackages.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">الباقات</h2>
        <button
          onClick={() => setShowPackageForm((p: boolean) => !p)}
          className="px-4 py-2 bg-primary text-primary-contrast rounded-lg hover:bg-primary-hover text-sm font-medium transition-colors"
        >
          {showPackageForm ? 'إلغاء' : '+ إضافة باقة'}
        </button>
      </div>

      {showPackageForm && (
        <div className="border border-border rounded-lg p-5 bg-bg-surface-alt space-y-4">
          <h3 className="font-semibold text-text-primary mb-3">باقة جديدة</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">اسم الباقة *</label>
              <input
                className="w-full border border-border p-2.5 rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="مثال: باقة 100 ريال"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">رقم الربط (الجسر) *</label>
              <select
                className="w-full border border-border p-2.5 rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                value={pkgBridge}
                onChange={(e) => setPkgBridge(e.target.value)}
              >
                <option value="">-- اختر الجسر --</option>
                {bridges.map((b: any) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">التكلفة (رأس المال)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-border p-2.5 rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                value={pkgPrice}
                onChange={(e) => setPkgPrice(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPackageForm(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleAddPackage}
              className="px-4 py-2 bg-primary text-primary-contrast rounded-lg hover:bg-primary-hover text-sm font-medium transition-colors"
            >
              حفظ الباقة
            </button>
          </div>
        </div>
      )}

      {product.packages && product.packages.length > 0 ? (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="min-w-full">
            <thead className="bg-bg-surface-alt">
              <tr className="border-b border-border">
                <th className="p-3 text-right text-sm font-semibold text-text-primary">اسم الباقة</th>
                <th className="p-3 text-right text-sm font-semibold text-text-primary">رقم الربط</th>
                <th className="p-3 text-right text-sm font-semibold text-text-primary">التكلفة</th>
                <th className="p-3 text-right text-sm font-semibold text-text-primary">الحالة</th>
                <th className="p-3 text-center text-sm font-semibold text-text-primary">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {product.packages.map((pkg: any) => (
                <PackageRowSimple
                  key={pkg.id}
                  pkg={pkg}
                  allPackages={product.packages || []}
                  availableBridges={bridges}
                  onChanged={() => {
                    fetchProduct();
                    fetchBridges();
                  }}
                  onDelete={() => handleDeletePackage(pkg.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-bg-surface-alt rounded-lg border border-dashed border-border">
          <p className="text-text-secondary">لا توجد باقات حالياً</p>
          <p className="text-sm text-text-secondary mt-1">انقر على "إضافة باقة" لإنشاء باقة جديدة</p>
        </div>
      )}
    </div>
  );
}

// ===== Edit Product Tab Component =====
function EditProductTab({
  product,
  imgSrc,
  imageSource,
  editName,
  setEditName,
  editActive,
  setEditActive,
  editSupportsCounter,
  setEditSupportsCounter,
  handleUpdateProduct,
  id,
  t,
}: any) {
  const [saving, setSaving] = useState(false);

  const sourceLabelMap = { catalog: 'كتالوج', custom: 'مخصص', none: 'لا يوجد' } as const;

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_ROUTES.products.base}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          isActive: editActive,
        }),
      });
      if (!res.ok) throw new Error('فشل حفظ التعديلات');
      alert('تم حفظ التعديلات بنجاح');
    } catch (e: any) {
      alert(e.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-4">تفاصيل المنتج</h2>
      </div>

      {/* صورة واسم المنتج */}
      <div className="flex items-start gap-6 p-5 bg-bg-surface-alt rounded-lg border border-border">
        <div className="shrink-0">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="w-24 h-24 object-cover rounded-lg border-2 border-border shadow-md"
              onError={(e: any) => {
                e.currentTarget.src = '/images/placeholder.png';
              }}
            />
          ) : (
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-bg-surface">
              <span className="text-text-secondary text-xs">لا صورة</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm text-text-secondary">اسم المنتج الأصلي</p>
          <p className="font-medium text-text-primary text-lg">{product.name}</p>
          {imageSource && imageSource !== 'none' && (
            <p className="text-xs text-text-secondary mt-2">
              المصدر: <span className="font-medium">{sourceLabelMap[imageSource as keyof typeof sourceLabelMap]}</span>
            </p>
          )}
        </div>
      </div>

      {/* الاسم الظاهر */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">الاسم الظاهر للعملاء</label>
        <input
          type="text"
          className="w-full border border-border p-3 rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="الاسم الذي سيظهر للعملاء"
        />
        <p className="text-xs text-text-secondary mt-1.5">هذا الاسم سيظهر في واجهة المتجر</p>
      </div>

      {/* الحالة */}
      <div className="p-4 bg-bg-surface-alt rounded-lg border border-border">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
            checked={editActive}
            onChange={(e) => setEditActive(e.target.checked)}
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-text-primary">حالة المنتج</span>
            <p className="text-xs text-text-secondary mt-0.5">
              {editActive ? 'المنتج مفعّل ومتاح للعملاء' : 'المنتج متوقف ولن يظهر للعملاء'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              editActive ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {editActive ? 'مفعّل' : 'متوقف'}
          </span>
        </label>
      </div>

      {/* يقبل العداد */}
      <div className="p-4 bg-bg-surface-alt rounded-lg border border-border">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
            checked={editSupportsCounter}
            onChange={(e) => {
              const next = e.target.checked;
              setEditSupportsCounter(next);
              
              // Mock: Just update locally
              console.log(`Mock: Updated supportsCounter to ${next}`);
              
              // Original API call (commented out for mock)
              /*
              try {
                const token = localStorage.getItem('token') || '';
                const res = await fetch(`${API_BASE_URL}/admin/products/${id}/supports-counter`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ supportsCounter: next }),
                });
                if (!res.ok) throw new Error('فشل تحديث وضع العداد');
              } catch (err: any) {
                alert(err.message || 'حدث خطأ');
                setEditSupportsCounter(!next);
              }
              */
            }}
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-text-primary">يقبل العداد</span>
            <p className="text-xs text-text-secondary mt-0.5">
              {editSupportsCounter ? 'يمكن للعملاء إدخال كميات مخصصة' : 'الكميات ثابتة حسب الباقات'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              editSupportsCounter ? 'bg-blue-500/20 text-blue-500' : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {editSupportsCounter ? 'مفعّل' : 'متوقف'}
          </span>
        </label>
      </div>

      {/* زر الحفظ */}
      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary text-primary-contrast rounded-lg hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}

// ===== Simple Package Row with Auto-save =====
function PackageRowSimple({
  pkg,
  allPackages,
  availableBridges,
  onChanged,
  onDelete,
}: {
  pkg: ProductPackage;
  allPackages: ProductPackage[];
  availableBridges: (number | string)[];
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(pkg.name);
  const [basePrice, setBasePrice] = useState<number>(pkg.basePrice);
  const [isActive, setIsActive] = useState<boolean>(pkg.isActive);
  const [code, setCode] = useState<string>(pkg.publicCode ? String(pkg.publicCode) : '');
  const [codeOptions, setCodeOptions] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  useEffect(() => {
    const current = pkg.publicCode != null ? [pkg.publicCode] : [];
    const merged = [...current, ...availableBridges];
    const numeric = merged
      .map((v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v))
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    const union = Array.from(new Set(numeric)).sort((a, b) => a - b);
    setCodeOptions(union);
  }, [allPackages.map((p) => p.publicCode).join(','), availableBridges.join(','), pkg.publicCode]);

  const autoSave = async (field: string, value: any) => {
    setSaving(true);
    try {
      // Mock: Update locally
      await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay
      
      console.log(`Mock: Saved ${field} = ${value} for package ${pkg.id}`);
      
      // In real implementation, you would call the API here
      /*
      if (field === 'code') {
        const res = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/code`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicCode: value ? Number(value) : null }),
        });
        if (!res.ok) throw new Error('فشل حفظ رقم الربط');
      } else {
        const payload: any = {};
        if (field === 'name') payload.name = value;
        if (field === 'basePrice') payload.basePrice = value;
        if (field === 'isActive') payload.isActive = value;

        const res = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/basic`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('فشل حفظ التعديلات');
      }
      */
      
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-bg-surface-alt/50 transition-colors">
      <td className="p-3">
        <input
          type="text"
          className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => autoSave('name', name)}
          disabled={saving}
        />
      </td>
      <td className="p-3">
        <select
          className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            autoSave('code', e.target.value);
          }}
          disabled={saving}
        >
          <option value="">-- اختر --</option>
          {codeOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <input
          type="number"
          step="0.01"
          className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          value={basePrice}
          onChange={(e) => setBasePrice(Number(e.target.value))}
          onBlur={() => autoSave('basePrice', basePrice)}
          disabled={saving}
        />
      </td>
      <td className="p-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
              autoSave('isActive', e.target.checked);
            }}
            disabled={saving}
          />
          <span className="text-sm text-text-secondary">{isActive ? 'مفعّل' : 'متوقف'}</span>
        </label>
      </td>
      <td className="p-3 text-center">
        <button
          onClick={onDelete}
          disabled={saving}
          className="px-3 py-1.5 bg-danger text-white rounded hover:bg-danger/90 text-sm transition-colors disabled:opacity-50"
        >
          حذف
        </button>
      </td>
    </tr>
  );
}
