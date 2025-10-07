"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import api, { API_ROUTES } from "@/utils/api";

interface Product {
  id: string;
  name: string;
  isActive: boolean;
  image?: string | null;
  imageUrl?: string | null;
  packages?: { isActive: boolean }[] | null;
}

function normalizeImageUrl(
  raw: string | null | undefined,
  apiHost: string
): string {
  if (!raw) return "/images/placeholder.png";
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${apiHost}${path}`;
}

export default function HomePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const apiHost = useMemo(() => {
    const base = API_ROUTES.products.base;
    try {
      const url = new URL(base);
      return url.origin;
    } catch {
      const trimmed = base.replace(/\/api[^]*$/i, "").replace(/\/$/, "");
      if (trimmed) return trimmed;
      if (typeof window !== "undefined") return window.location.origin;
      return "";
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Product[]>(API_ROUTES.products.base);
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setError("فشل في جلب المنتجات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <p className="text-center mt-6">⏳ جاري تحميل المنتجات...</p>;
  if (error)
    return <p className="text-center text-danger mt-6">{error}</p>;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container">
      {/* شريط البحث */}
      <div className="mb-6 flex justify-center">
        <input
          type="text"
          placeholder="بحث..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-bg-input text-text-primary w-full sm:w-1/3 border border-border p-2 rounded-xl focus:outline-none focus:border-primary transition"
        />
      </div>

      {/* الشبكة */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {filtered.map((product) => {
          const available =
            product.isActive &&
            (product.packages?.some((pkg) => pkg.isActive) ?? true);

          const raw = product.image ?? product.imageUrl ?? null;
          const src = failed.has(product.id)
            ? "/images/placeholder.png"
            : normalizeImageUrl(raw, apiHost);

          return (
            <div
              key={product.id}
              onClick={() =>
                available && router.push(`/product/${product.id}`)
              }
              className={`group flex flex-col items-center select-none ${
                available
                  ? "cursor-pointer"
                  : "opacity-40 pointer-events-none"
              }`}
              title={product.name}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 bg-bg-surface border border-border shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={product.name}
                  className="w-full h-full object-cover rounded-xl"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailed((prev) => {
                      if (prev.has(product.id)) return prev;
                      const next = new Set(prev);
                      next.add(product.id);
                      return next;
                    })
                  }
                />
              </div>
              <div className="text-center text-[13px] sm:text-sm mt-2 text-text-primary sm:w-24 truncate">
                {product.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
