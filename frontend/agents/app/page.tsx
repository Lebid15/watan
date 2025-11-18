"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BannerSlider from "@/components/BannerSlider";
import { getActiveMockProducts, type MockProduct as Product } from "@/data/mockProducts";
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

function normalizeImageUrl(
  raw: string | null | undefined
): string {
  if (!raw) return "/images/placeholder.png";
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return "/images/placeholder.png";
}

export default function HomePage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {}
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  useEffect(() => {
    // محاكاة تحميل البيانات
    const timer = setTimeout(() => {
      setProducts(getActiveMockProducts());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (!namespaceReady || loading)
    return <p className="text-center mt-6">{t('home.loading')}</p>;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container pt-2 sm:pt-4 md:pt-6">
      {/* سلايدر البانرات */}
      <BannerSlider />

      {/* شريط البحث */}
      <div className="-mt-4 sm:mt-2 md:mt-3 mb-4 flex justify-center px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
        <input
          type="text"
          placeholder={t('home.search.placeholder')}
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
            : normalizeImageUrl(raw);

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
              <div className="text-center text-[13px] sm:text-sm mt-2 text-text-primary sm:w-24 line-clamp-2 leading-tight">
                {product.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
