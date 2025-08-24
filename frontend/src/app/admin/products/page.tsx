"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_ROUTES } from "@/utils/api";

interface Product {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  image?: string;
  imageUrl?: string;
  createdAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const apiHost = useMemo(
    () => API_ROUTES.products.base.replace(/\/api\/products\/?$/, ""),
    []
  );
  const apiBase = useMemo(() => `${apiHost}/api`, [apiHost]);
  const productsUrl = `${apiBase}/products`;

  const fetchProducts = async () => {
    try {
      const res = await fetch(productsUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("فشل في جلب المنتجات");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  function pickImageField(p: Product): string | null {
    return (p.image ?? p.imageUrl) || null;
  }

  function buildImageSrc(raw?: string | null): string {
    if (!raw) return "/images/placeholder.png";
    const s = String(raw).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return `${apiHost}${s}`;
    return `${apiHost}/${s}`;
  }

  function getImageSrc(p: Product): string {
    if (failed.has(p.id)) return "/images/placeholder.png";
    return buildImageSrc(pickImageField(p));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return alert("يرجى إدخال اسم المنتج");
    setAdding(true);
    try {
      const createRes = await fetch(productsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!createRes.ok) throw new Error("فشل في إنشاء المنتج");
      const created: Product = await createRes.json();

      if (newImage) {
        const formData = new FormData();
        formData.append("image", newImage);
        const uploadRes = await fetch(`${productsUrl}/${created.id}/image`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const t = await uploadRes.text().catch(() => "");
          console.error("فشل في رفع الصورة:", t);
        }
      }

      await fetchProducts();
      setShowForm(false);
      setNewName("");
      setNewImage(null);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setAdding(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-bg-base))] min-h-screen">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-2 md:px-4 py-2 mb-3 md:mb-4 gap-2 bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))] rounded-lg">
        <h1 className="text-lg md:text-2xl font-bold">إدارة المنتجات</h1>

        <input
          type="text"
          placeholder="بحث..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border border-[rgb(var(--color-border))] rounded-xl px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-[rgb(var(--color-bg-input))] text-[rgb(var(--color-text-primary))]"
        />

        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm md:text-base whitespace-nowrap
                     bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-hover))]
                     text-[rgb(var(--color-primary-contrast))]"
        >
          {showForm ? "إلغاء" : "+ إضافة منتج جديد"}
        </button>
      </div>

      {/* نموذج الإضافة */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="px-2 md:px-4 mb-4 md:mb-6 p-3 md:p-4 rounded-lg shadow space-y-3 bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))]"
        >
          <div>
            <label className="block mb-1 md:mb-2 text-sm md:text-base">اسم المنتج</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-[rgb(var(--color-border))] rounded px-3 py-1.5 md:py-2 bg-[rgb(var(--color-bg-input))] text-[rgb(var(--color-text-primary))]"
              disabled={adding}
            />
          </div>

          <div>
            <label className="block mb-1 md:mb-2 text-sm md:text-base">صورة المنتج (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files && setNewImage(e.target.files[0])}
              className="w-full text-sm md:text-base"
              disabled={adding}
            />
          </div>

          <button
            type="submit"
            className="px-3 md:px-4 py-1.5 md:py-2 rounded text-sm md:text-base
                       bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-hover))]
                       text-[rgb(var(--color-primary-contrast))]"
            disabled={adding}
          >
            {adding ? "جاري الإضافة..." : "حفظ"}
          </button>
        </form>
      )}

      {/* شبكة المنتجات */}
      {filtered.length === 0 ? (
        <p className="px-2 md:px-4 text-[rgb(var(--color-text-secondary))]">لا توجد منتجات.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 md:gap-4 px-2 md:px-4 py-2">
          {filtered.map((product) => {
            const available = product.isActive;
            const imageSrc = getImageSrc(product);

            return (
              <Link
                key={product.id}
                href={available ? `/admin/products/${product.id}` : "#"}
                className={`group flex flex-col items-center select-none ${
                  available ? "cursor-pointer" : "opacity-40 pointer-events-none"
                }`}
                title={product.name}
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shadow-md overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 rounded-xl bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border))]">
                  <img
                    src={imageSrc}
                    alt={product.name}
                    className="w-3/4 h-3/4 object-contain rounded-lg"
                    loading="lazy"
                    onError={() =>
                      setFailed((prev) => {
                        if (prev.has(product.id)) return prev;
                        const next = new Set(prev);
                        next.add(product.id);
                        return next;
                      })
                    }
                  />
                  {!available && (
                    <span className="absolute bottom-1 right-1 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-danger))] text-[rgb(var(--color-primary-contrast))]">
                      غير متوفر
                    </span>
                  )}
                </div>

                <div className="mt-1.5 md:mt-2 text-center text-[11px] sm:text-[12px] md:text-sm text-[rgb(var(--color-text-primary))] truncate w-16 sm:w-20 md:w-24">
                  {product.name}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
