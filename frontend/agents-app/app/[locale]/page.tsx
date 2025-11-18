"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { ImageSlider } from "@/components/slider/image-slider";
import { SearchBar } from "@/components/search/search-bar";
import Link from "next/link";
import { useBackendSession } from "@/context/auth-session";
import { useZNetData } from "@/hooks/useZNetData";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { ProviderCredentialCard } from "@/components/providers/provider-credential-card";
import { useProviderCredentialContext } from "@/hooks/useProviderCredentials";

export default function AgentsPage() {
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const { status, connect, error: authError } = useBackendSession();
  const ready = status === "ready";
  const {
    selectedCredentialId,
    hasCredentials,
    loading: credentialLoading,
  } = useProviderCredentialContext();
  const credentialReady = ready && Boolean(selectedCredentialId);
  const { products, balance, loading, error, reload } = useZNetData(
    credentialReady,
    selectedCredentialId
  );

  const filteredProducts = useMemo(() => {
    if (!products?.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(q) ||
      product.game.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const balanceValue = typeof balance?.balance === "number" ? balance.balance : undefined;

  const formatPrice = (value: number) => {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale === "tr" ? "tr-TR" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const errorMessage = authError || error;
  const showCredentialWarning =
    ready && !credentialLoading && (!hasCredentials || !selectedCredentialId);

  return (
    <div className="space-y-6">
      {/* Image Slider */}
      <ImageSlider />

      {!ready && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-lg">
          <h2 className="text-xl font-bold mb-2">
            {locale === "ar" ? "ابدأ بربط حساب Auth0" : locale === "tr" ? "Auth0 hesabını bağla" : "Connect your Auth0 account"}
          </h2>
          <p className="text-muted-foreground mb-4">
            {locale === "ar"
              ? "سجل دخولك لعرض المنتجات والأسعار المباشرة من المزود"
              : locale === "tr"
              ? "Tedarikçi fiyatlarını görmek için giriş yapın"
              : "Sign in to load live provider pricing"}
          </p>
          <Button onClick={() => connect()} size="lg">
            {locale === "ar" ? "تسجيل الدخول" : locale === "tr" ? "Giriş Yap" : "Sign in"}
          </Button>
        </div>
      )}

      {ready && <ProviderCredentialCard locale={locale} />}

      {showCredentialWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 shadow-sm">
          <p className="font-semibold mb-1">
            {locale === "ar"
              ? "أضف بيانات اعتماد ZNet لعرض الأسعار"
              : locale === "tr"
              ? "Fiyatları görmek için ZNet hesabı ekleyin"
              : "Add a ZNet credential to load pricing"}
          </p>
          <p className="text-sm">
            {locale === "ar"
              ? "يمكنك حفظ حساب المزود الخاص بك، ثم سيتم استخدامه تلقائياً في كل الطلبات"
              : locale === "tr"
              ? "Sağlayıcı hesabınızı kaydedin, talepler otomatik olarak bu kimliği kullanır"
              : "Save your provider account once and we will use it for all requests"}
          </p>
        </div>
      )}

      {typeof balanceValue === "number" && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-md grid grid-cols-1 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{locale === "ar" ? "رصيد المزود" : locale === "tr" ? "Tedarikçi bakiyesi" : "Provider balance"}</p>
            <p className="text-2xl font-semibold text-gold">{formatPrice(balanceValue)}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => reload()}
              disabled={loading || !credentialReady}
              className="gap-2"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {locale === "ar" ? "تحديث" : locale === "tr" ? "Yenile" : "Refresh"}
            </Button>
            {errorMessage && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Products Grid */}
      <div className="space-y-4">
        {credentialReady ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/${locale}/product/${product.id}`}
                  className="group relative cursor-pointer"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-beige-100 to-beige-200 dark:from-neutral-800 dark:to-neutral-900 group-hover:scale-105 transition-transform duration-500 shadow-md group-hover:shadow-xl border-2 border-transparent group-hover:border-gold flex items-center justify-center">
                    <span className="text-3xl" aria-hidden>
                      🎮
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 group-hover:translate-x-full transform -translate-x-full"></div>
                  </div>

                  {/* Product Name */}
                  <div className="mt-2 text-center">
                    <h3 className="text-sm md:text-base font-semibold group-hover:text-gold transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{formatPrice(product.price_try)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{product.game}</p>
                  </div>
                </Link>
              ))}
              {!loading && filteredProducts.length === 0 && ready && (
                <div className="col-span-full text-center text-muted-foreground py-12">
                  {locale === "ar"
                    ? "لا توجد منتجات مطابقة"
                    : locale === "tr"
                    ? "Uygun ürün bulunamadı"
                    : "No products match your search"}
                </div>
              )}
            </div>
            {loading && (
              <p className="text-center text-sm text-muted-foreground">
                {locale === "ar"
                  ? "جاري تحميل المنتجات..."
                  : locale === "tr"
                  ? "Ürünler yükleniyor..."
                  : "Loading products..."}
              </p>
            )}
          </>
        ) : (
          ready && (
            <div className="text-center text-muted-foreground py-10 border border-dashed rounded-2xl">
              {credentialLoading
                ? locale === "ar"
                  ? "جاري تحميل بيانات الاعتماد..."
                  : locale === "tr"
                  ? "Kimlik bilgileri yükleniyor..."
                  : "Loading credentials..."
                : locale === "ar"
                ? "أضف بيانات اعتماد ZNet للمتابعة"
                : locale === "tr"
                ? "Devam etmek için ZNet kimliğini ekleyin"
                : "Add a ZNet credential to continue"}
            </div>
          )
        )}
      </div>
    </div>
  );
}
