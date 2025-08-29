"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_ROUTES } from "@/utils/api";

interface ProductPackage {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  publicCode?: number | null;
}

// لم يعد هناك قائمة ثابتة؛ نستخرج الأكواد المتاحة من باقات المنتج نفسها
// بحيث لا يمكن للمستأجر إضافة كود جديد خارج ما وفره المطوّر مسبقًا.

interface Product {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;          // ⬅️ الحقل الصحيح الذي يعيده/يحفظه السيرفر
  customImageUrl?: string | null; // صورة مخصصة (قد تكون null)
  useCatalogImage?: boolean;      // هل يعتمد صورة الكتالوج؟
  imageSource?: 'catalog' | 'custom' | null; // مصدر الصورة المحسوبة من السيرفر (للشارات)
  hasCustomImage?: boolean;      // هل توجد صورة مخصصة مخزّنة؟
  catalogAltText?: string | null;
  customAltText?: string | null;
  isActive: boolean;
  packages?: ProductPackage[];
}

async function uploadToCloudinary(file: File, token: string, apiBase: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  } catch (e: any) {
    // Network/DNS errors: surface minimal message
    throw new Error('تعذر الاتصال بالخادم أثناء الرفع');
  }
  if (res.status !== 200 && res.status !== 201) {
    // Map status codes
    if (res.status === 401 || res.status === 403) throw new Error('جلسة منتهية، يرجى تسجيل الدخول');
    if (res.status === 413) throw new Error('الصورة كبيرة جدًا');
    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const msg: string = payload?.message || payload?.error || '';
    if (/cloudinary/i.test(msg) && /غير صحيحة|bad credential|cloudinary/i.test(msg)) {
      throw new Error('إعدادات Cloudinary غير صحيحة');
    }
    if (payload?.code === 'file_too_large') throw new Error('الصورة كبيرة جدًا');
    if (payload?.code === 'cloudinary_bad_credentials') throw new Error('إعدادات Cloudinary غير صحيحة');
    throw new Error(msg || 'فشل رفع الملف…');
  }
  const data = await res.json().catch(() => ({}));
  const url: string | undefined = data?.url || data?.secure_url || (data as any)?.imageUrl || data?.data?.url || data?.data?.secure_url || (data as any)?.data?.imageUrl;
  if (!url) {
    console.error('Upload response payload:', data);
    throw new Error('لم يتم استلام رابط الصورة');
  }
  return url;
}

export default function AdminProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [editUseCatalog, setEditUseCatalog] = useState<boolean>(false);
  const [editCatalogAlt, setEditCatalogAlt] = useState<string>("");
  const [editCustomAlt, setEditCustomAlt] = useState<string>("");

  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgPrice, setPkgPrice] = useState<number>(0);
  const [pkgBridge, setPkgBridge] = useState<string>("");
  const [bridges, setBridges] = useState<number[]>([]);
  const [bridgesLoading, setBridgesLoading] = useState<boolean>(false);
  const [showPackageForm, setShowPackageForm] = useState(false);

  const apiHost = API_ROUTES.products.base.replace("/api/products", ""); // لعرض الصور النسبية إن وجدت
  const apiBase = `${apiHost}/api`;

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_ROUTES.products.base}/${id}?all=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل في جلب بيانات المنتج");
      const data: Product = await res.json();
      setProduct(data);
      setEditName(data.name);
      setEditDesc(data.description || "");
      setEditActive(data.isActive);
  setEditUseCatalog(Boolean(data.useCatalogImage));
  setEditCatalogAlt(data.catalogAltText || "");
  setEditCustomAlt(data.customAltText || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBridges = async () => {
    if (!id) return;
    try {
      setBridgesLoading(true);
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_ROUTES.products.base}/${id}/bridges`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBridges(Array.isArray(data.available) ? data.available : []);
    } catch {
      setBridges([]);
    } finally {
      setBridgesLoading(false);
    }
  };

  useEffect(() => {
  if (id) fetchProduct();
  if (id) fetchBridges();
  }, [id]);

  const handleUpdateProduct = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      if (!token) throw new Error("الرجاء تسجيل الدخول كمسؤول.");

      // منطق تحديد الصورة:
      // 1) إذا قام المستخدم برفع صورة جديدة => نرفعها ونعتبرها customImageUrl ونوقف useCatalogImage
      // 2) إذا حدد useCatalogImage مع عدم وجود رفع جديد نرسل فقط useCatalogImage
      // 3) إذا ألغى useCatalogImage بدون رفع جديد لكن لديه customImageUrl سابق لا نغيّر الرابط
      let imageUrl = product?.imageUrl; // الحقل الفعّال الحالي (قد يكون كتالوج أو مخصص)
      let customImageUrl = product?.customImageUrl ?? null;

      let useCatalogImage = editUseCatalog;
      if (editImage) {
        // Use new unified flow: upload then PATCH catalog product image (propagate if tenant context available)
        const uploaded = await uploadToCloudinary(editImage, token, apiBase);
        customImageUrl = uploaded;
        imageUrl = uploaded;
        useCatalogImage = false;
      }

      const updateRes = await fetch(`${API_ROUTES.products.base}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          // نرسل الحقول الداعمة للميزة الجديدة
          imageUrl,               // الحقل الفعّال (للتوافق مع الواجهات الحالية في السيرفر إن احتاج)
          customImageUrl,         // مسار أو رابط الصورة المخصصة إن وجدت
          useCatalogImage,        // التبديل
          catalogAltText: editCatalogAlt || null,
          customAltText: editCustomAlt || null,
          isActive: editActive,
        }),
      });

  if (!updateRes.ok) throw new Error("فشل في تعديل المنتج");
      setEditImage(null);
      await fetchProduct();
      alert("تم حفظ التغييرات بنجاح");
    } catch (err: any) {
  alert(err.message);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_ROUTES.products.base}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل في حذف المنتج");
      router.push("/admin/products");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddPackage = async () => {
  if (!pkgName) return alert("يرجى إدخال اسم الباقة");
  if (!pkgBridge) return alert("يرجى اختيار الجسر");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_ROUTES.products.base}/${id}/packages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: pkgName,
          description: pkgDesc,
          basePrice: pkgPrice,
  publicCode: pkgBridge, // نرسله ليتوافق مع واجهة التحديث العامة
  catalogLinkCode: pkgBridge, // لضمان عدم فشل التحقق في حالة تفعيل ميزة ربط الكتالوج
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("فشل في إضافة الباقة");
      setPkgName("");
      setPkgDesc("");
      setPkgPrice(0);
    setPkgBridge("");
      setShowPackageForm(false);
    fetchProduct();
    fetchBridges();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الباقة؟")) return;
    try {
      const token = localStorage.getItem("token") || "";
      await fetch(`${API_ROUTES.products.base}/packages/${pkgId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProduct();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <p className="p-4 text-text-primary">جاري التحميل...</p>;
  if (error) return <p className="p-4 text-danger">{error}</p>;
  if (!product) return <p className="p-4 text-text-secondary">المنتج غير موجود</p>;

  // اختيار رابط الصورة الصحيح للعرض (imageUrl الفعّال قد يأتي نسبي أو مطلق)
  const imgSrc = product.imageUrl
    ? (product.imageUrl.startsWith('http')
        ? product.imageUrl
        : product.imageUrl.startsWith('/')
          ? `${apiHost}${product.imageUrl}`
          : `${apiHost}/${product.imageUrl}`)
    : null;

  // شارة مصدر الصورة
  const imageSource: 'catalog' | 'custom' | 'none' = product.imageSource
    ? product.imageSource
    : product.imageUrl
      ? (product.useCatalogImage ? 'catalog' : 'custom')
      : 'none';
  const sourceLabelMap: Record<typeof imageSource, string> = {
    catalog: 'Catalog',
    custom: 'Custom',
    none: 'None'
  } as const;
  const badgeColor = imageSource === 'catalog'
    ? 'bg-blue-600'
    : imageSource === 'custom'
      ? 'bg-emerald-600'
      : 'bg-gray-400';

  return (
    <div className="p-6 bg-bg-surface rounded shadow max-w-3xl mx-auto text-text-primary border border-border">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">المنتج: {product.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={handleUpdateProduct}
            className="px-4 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover"
          >
            حفظ التغييرات
          </button>
          <button
            onClick={handleDeleteProduct}
            className="px-4 py-2 bg-danger text-text-inverse rounded hover:brightness-110"
          >
            حذف المنتج
          </button>
        </div>
      </div>

      <input
        className="w-full border border-border p-2 rounded mb-2 bg-bg-surface-alt text-text-primary"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        placeholder="اسم المنتج"
      />
      <textarea
        className="w-full border border-border p-2 rounded mb-2 bg-bg-surface-alt text-text-primary"
        value={editDesc}
        onChange={(e) => setEditDesc(e.target.value)}
        placeholder="الوصف"
      />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[12px] text-text-secondary mb-1">نص بديل (كتالوج)</label>
          <input
            className="w-full border border-border p-2 rounded bg-bg-surface-alt text-text-primary"
            value={editCatalogAlt}
            onChange={(e) => setEditCatalogAlt(e.target.value)}
            placeholder="مثال: بطاقة هدايا متجر X"
          />
        </div>
        <div>
          <label className="block text-[12px] text-text-secondary mb-1">نص بديل (مخصص)</label>
          <input
            className="w-full border border-border p-2 rounded bg-bg-surface-alt text-text-primary"
            value={editCustomAlt}
            onChange={(e) => setEditCustomAlt(e.target.value)}
            placeholder="وصف دقيق للصورة المخصصة"
          />
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${badgeColor}`}>
            {sourceLabelMap[imageSource]}
          </span>
          {imageSource !== 'none' && (
            <span className="text-[11px] text-text-secondary">(المصدر الحالي)</span>
          )}
        </div>
        <label className="flex items-center gap-2 text-text-secondary">
          <input
            type="checkbox"
            checked={editUseCatalog}
            onChange={(e) => setEditUseCatalog(e.target.checked)}
          />
          استخدم صورة الكتالوج
        </label>
        <div>
          <label className="block text-[12px] text-text-secondary mb-1">صورة مخصصة (تجاوز)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && setEditImage(e.target.files[0])}
            className="text-text-secondary max-w-xs"
            disabled={editUseCatalog}
          />
          {editUseCatalog && (
            <div className="text-[11px] mt-1 text-text-secondary">إلغاء التحديد لتفعيل الرفع المخصص</div>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 mb-4 text-text-secondary">
        <input
          type="checkbox"
          checked={editActive}
          onChange={(e) => setEditActive(e.target.checked)}
        />
        فعال؟
      </label>

      <div className="mb-6">
        {imgSrc ? (
          <div className="relative inline-block">
            <img
              src={imgSrc}
              alt={product.name}
              className="w-20 h-20 object-cover rounded border border-border shadow"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/placeholder.png'; }}
            />
            <span className={`absolute -top-2 -right-2 ${badgeColor} text-white text-[10px] px-1.5 py-0.5 rounded-full shadow`}>{sourceLabelMap[imageSource]}</span>
          </div>
        ) : (
          <div className="w-20 h-20 rounded border border-dashed border-border flex items-center justify-center text-text-secondary text-xs">
            لا توجد صورة
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">الباقات</h2>
        <button
          onClick={() => setShowPackageForm((prev) => !prev)}
          className="px-3 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover text-sm"
        >
          {showPackageForm ? "إغلاق النموذج" : "+ إضافة باقة جديدة"}
        </button>
      </div>
      {product.packages && product.packages.length > 0 ? (
        <div className="overflow-x-auto border border-border rounded mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-surface-alt text-text-secondary text-xs">
              <tr>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-right">الكود / الجسر</th>
                <th className="p-2 text-right">الوصف</th>
                <th className="p-2 text-right">رأس المال</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {product.packages.map((pkg) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  allPackages={product.packages || []}
                  availableBridges={bridges}
                  onChanged={() => { fetchProduct(); fetchBridges(); }}
                  onDelete={() => handleDeletePackage(pkg.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-text-secondary mb-4">لا توجد باقات</p>
      )}

      {showPackageForm && (
        <div className="mt-4 p-4 border border-border rounded bg-bg-surface-alt">
          <input
            className="w-full border border-border p-2 mb-2 rounded bg-bg-surface text-text-primary"
            placeholder="اسم الباقة"
            value={pkgName}
            onChange={(e) => setPkgName(e.target.value)}
          />
          <textarea
            className="w-full border border-border p-2 mb-2 rounded bg-bg-surface text-text-primary"
            placeholder="الوصف (اختياري)"
            value={pkgDesc}
            onChange={(e) => setPkgDesc(e.target.value)}
          />
          <h2 className="text-text-secondary">رأس المال (يمكن أن يكون صفراً)</h2>
          <input
            type="number"
            className="w-full border border-border p-2 mb-2 rounded bg-bg-surface text-text-primary"
            placeholder="رأس المال"
            value={pkgPrice}
            onChange={(e) => setPkgPrice(parseFloat(e.target.value))}
          />
          <div className="mb-2">
            <label className="block text-text-secondary text-sm mb-1 flex items-center gap-2">
              <span>الجسر (مطلوب)</span>
              <button
                type="button"
                onClick={fetchBridges}
                className="text-[11px] px-2 py-0.5 rounded bg-bg-surface border border-border hover:bg-bg-surface-alt"
                disabled={bridgesLoading}
              >تحديث</button>
            </label>
            <select
              className="w-full border border-border p-2 rounded bg-bg-surface text-text-primary"
              value={pkgBridge}
              onChange={(e) => setPkgBridge(e.target.value)}
            >
              <option value="">-- اختر الجسر --</option>
              {bridgesLoading && <option value="" disabled>جاري التحميل...</option>}
              {!bridgesLoading && bridges.length === 0 && <option value="" disabled>لا توجد جسور متاحة (اطلب من المطوّر إضافة كود)</option>}
              {bridges
                .filter(b => !isNaN(Number(b)))
                .sort((a,b)=>a-b)
                .map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
            </select>
            <div className="text-[11px] mt-1 text-text-secondary">يتم جلب الأكواد من مصدر المطوّر؛ لا يمكنك إدخال رقم جديد يدويًا.</div>
          </div>
          <button
            onClick={handleAddPackage}
            className="px-4 py-2 bg-success text-text-inverse rounded hover:brightness-110"
          >
            حفظ الباقة
          </button>
        </div>
      )}
    </div>
  );
}

// ===== صف الباقة =====
function PackageRow({ pkg, allPackages, availableBridges, onChanged, onDelete }: { pkg: ProductPackage; allPackages: ProductPackage[]; availableBridges: number[]; onChanged: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pkg.name);
  const [desc, setDesc] = useState(pkg.description || "");
  const [basePrice, setBasePrice] = useState<number>(pkg.basePrice);
  const [isActive, setIsActive] = useState<boolean>(pkg.isActive);
  const [codeOptions, setCodeOptions] = useState<number[]>([]);
  const [code, setCode] = useState<string>(pkg.publicCode ? String(pkg.publicCode) : "");
  const [saving, setSaving] = useState(false);
  const token = (typeof window !== 'undefined') ? localStorage.getItem('token') || '' : '';

  // الأكواد المسموح اختيارها = (الكود الحالي) + الأكواد المتاحة غير المستخدمة من API
  useEffect(() => {
    const current = (pkg.publicCode && typeof pkg.publicCode === 'number') ? [pkg.publicCode] : [];
    const union = Array.from(new Set([...current, ...availableBridges]))
      .filter((v): v is number => typeof v === 'number')
      .sort((a,b)=>a-b);
    setCodeOptions(union);
  }, [allPackages.map(p => p.publicCode).join(','), availableBridges.join(','), pkg.publicCode]);

  const saveBasic = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/basic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: desc || null, basePrice, isActive })
      });
      if (!res.ok) throw new Error('فشل حفظ التعديلات');
      // حفظ الكود (إن تغير)
      if ((code || '').trim() !== String(pkg.publicCode || '')) {
        const body: any = { publicCode: code ? Number(code) : null };
        const r2 = await fetch(`${API_ROUTES.products.base}/packages/${pkg.id}/code`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        if (!r2.ok) throw new Error('تم حفظ الباقة لكن فشل تحديث الكود');
      }
      setEditing(false);
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-border">
      <td className="p-2 align-top">
        {editing ? (
          <input className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" value={name} onChange={e => setName(e.target.value)} />
        ) : (
          <span className="font-medium">{pkg.name}</span>
        )}
      </td>
      <td className="p-2 align-top">
        {editing ? (
          <select className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" value={code} onChange={e => setCode(e.target.value)}>
            <option value="">اختر</option>
            {codeOptions.map(c => (<option key={c} value={c}>{c}</option>))}
          </select>
        ) : (
          pkg.publicCode ? <span>{pkg.publicCode}</span> : <span className="text-text-secondary">—</span>
        )}
      </td>
      <td className="p-2 align-top max-w-[200px]">
        {editing ? (
          <textarea className="w-full text-sm p-1 rounded bg-bg-surface-alt border border-border" rows={2} value={desc} onChange={e => setDesc(e.target.value)} />
        ) : (
          pkg.description ? (
            <span title={pkg.description} className="line-clamp-2 whitespace-pre-wrap text-[12px] text-text-secondary">{pkg.description}</span>
          ) : <span className="text-text-secondary">—</span>
        )}
      </td>
      <td className="p-2 align-top">
        {editing ? (
          <input type="number" className="w-24 text-sm p-1 rounded bg-bg-surface-alt border border-border" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))} />
        ) : (
          <span>{pkg.basePrice}</span>
        )}
      </td>
      <td className="p-2 align-top">
        {editing ? (
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span>{isActive ? 'فعال' : 'متوقف'}</span>
          </label>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full ${pkg.isActive ? 'bg-emerald-600/20 text-emerald-500' : 'bg-gray-600/30 text-gray-400'}`}>{pkg.isActive ? 'فعال' : 'متوقف'}</span>
        )}
      </td>
      <td className="p-2 align-top space-x-1 space-x-reverse flex gap-2">
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
