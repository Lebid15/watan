"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { API_ROUTES } from "@/utils/api";
import { ErrorResponse } from "@/types/common";

interface ProductPackage {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
}

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
  } catch (e: unknown) {
    // Network/DNS errors: surface minimal message
    throw new Error('تعذر الاتصال بالخادم أثناء الرفع');
  }
  if (res.status !== 200 && res.status !== 201) {
    // Map status codes
    if (res.status === 401 || res.status === 403) throw new Error('جلسة منتهية، يرجى تسجيل الدخول');
    if (res.status === 413) throw new Error('الصورة كبيرة جدًا');
    let payload: Record<string, unknown> | null = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const msg: string = String(payload?.message || payload?.error || '');
    if (/cloudinary/i.test(msg) && /غير صحيحة|bad credential|cloudinary/i.test(msg)) {
      throw new Error('إعدادات Cloudinary غير صحيحة');
    }
    if (payload?.code === 'file_too_large') throw new Error('الصورة كبيرة جدًا');
    if (payload?.code === 'cloudinary_bad_credentials') throw new Error('إعدادات Cloudinary غير صحيحة');
    throw new Error(msg || 'فشل رفع الملف…');
  }
  const data = await res.json().catch(() => ({}));
  const dataRecord = data as Record<string, unknown>;
  const dataData = dataRecord?.data as Record<string, unknown> | undefined;
  const url: string | undefined = String(dataRecord?.url || '') || String(dataRecord?.secure_url || '') || String(dataRecord?.imageUrl || '') || String(dataData?.url || '') || String(dataData?.secure_url || '') || String(dataData?.imageUrl || '') || undefined;
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
  const [showPackageForm, setShowPackageForm] = useState(false);

  const apiHost = API_ROUTES.products.base.replace("/api/products", ""); // لعرض الصور النسبية إن وجدت
  const apiBase = `${apiHost}/api`;

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_ROUTES.products.base}/${id}`, {
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
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      setError(error.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchProduct();
  }, [id, fetchProduct]);

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
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      alert(error.message || 'حدث خطأ غير متوقع');
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
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      alert(error.message || 'حدث خطأ غير متوقع');
    }
  };

  const handleAddPackage = async () => {
    if (!pkgName || !pkgPrice) return alert("يرجى إدخال اسم وسعر الباقة");
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
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("فشل في إضافة الباقة");
      setPkgName("");
      setPkgDesc("");
      setPkgPrice(0);
      setShowPackageForm(false);
      fetchProduct();
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      alert(error.message || 'حدث خطأ غير متوقع');
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
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      alert(error.message || 'حدث خطأ غير متوقع');
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
            <Image
              src={imgSrc}
              alt={product.name}
              width={80}
              height={80}
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

      <h2 className="text-xl font-semibold mb-2">الباقات</h2>
      {product.packages && product.packages.length > 0 ? (
        <ul className="space-y-3">
          {product.packages.map((pkg) => (
            <li key={pkg.id} className="flex justify-between items-center gap-3 bg-bg-surface-alt p-2 rounded border border-border">
              <div>
                <strong>{pkg.name}</strong> – {pkg.basePrice}
                {pkg.description && (
                  <p className="text-sm text-text-secondary">{pkg.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDeletePackage(pkg.id)}
                className="px-3 py-1 bg-danger text-text-inverse rounded hover:brightness-110 text-sm"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">لا توجد باقات</p>
      )}

      <button
        onClick={() => setShowPackageForm((prev) => !prev)}
        className="mt-6 px-4 py-2 bg-primary text-primary-contrast rounded hover:bg-primary-hover"
      >
        {showPackageForm ? "إغلاق النموذج" : "+ إضافة باقة جديدة"}
      </button>

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
          <h2 className="text-text-secondary">السعر</h2>
          <input
            type="number"
            className="w-full border border-border p-2 mb-2 rounded bg-bg-surface text-text-primary"
            placeholder="السعر الأساسي"
            value={pkgPrice}
            onChange={(e) => setPkgPrice(parseFloat(e.target.value))}
          />
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
