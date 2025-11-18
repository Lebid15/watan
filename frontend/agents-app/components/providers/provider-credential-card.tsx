"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProviderCredentialContext } from "@/hooks/useProviderCredentials";
import { AlertCircle, PlusCircle, RefreshCcw } from "lucide-react";

export function ProviderCredentialCard({ locale }: { locale: string }) {
  const {
    credentials,
    selectedCredentialId,
    selectCredential,
    createCredential,
    loading,
    creating,
    error,
    hasCredentials,
    refresh,
  } = useProviderCredentialContext();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    base_url: "https://bayi.alayatl.com",
    kod: "",
    sifre: "",
  });

  const selectLabel =
    locale === "ar"
      ? "اختر بيانات اعتماد المزود"
      : locale === "tr"
      ? "Sağlayıcı hesabını seç"
      : "Select provider credential";

  const description =
    locale === "ar"
      ? "استخدم بيانات اعتماد مختلفة لكل مستأجر أو مزود"
      : locale === "tr"
      ? "Her kiracı veya sağlayıcı için ayrı hesap ekleyin"
      : "Create distinct credentials per tenant or provider";

  const addLabel =
    locale === "ar"
      ? showForm
        ? "إلغاء"
        : "إضافة بيانات اعتماد"
      : locale === "tr"
      ? showForm
        ? "İptal"
        : "Kimlik bilgisi ekle"
      : showForm
      ? "Cancel"
      : "Add credential";

  const emptyMessage =
    locale === "ar"
      ? "لا توجد بيانات اعتماد محفوظة بعد"
      : locale === "tr"
      ? "Henüz kayıtlı kimlik bilgisi yok"
      : "No credentials saved yet";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createCredential({ ...form });
      setForm({ base_url: form.base_url, kod: "", sifre: "" });
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : locale === "tr"
          ? "Kimlik bilgisi eklenemedi"
          : "تعذر حفظ بيانات الاعتماد"
      );
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gold">ZNet</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <PlusCircle className="h-4 w-4" />
            {addLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">{selectLabel}</label>
        {hasCredentials ? (
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedCredentialId}
            onChange={(event) => selectCredential(event.target.value)}
            disabled={loading}
          >
            {credentials.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credential.base_url} · {credential.id.slice(0, 6)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>

      {showForm && (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">
              {locale === "ar"
                ? "عنوان واجهة المزود"
                : locale === "tr"
                ? "Sağlayıcı tabanı"
                : "Provider base URL"}
            </label>
            <Input
              value={form.base_url}
              onChange={(event) => setForm((prev) => ({ ...prev, base_url: event.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">KOD</label>
              <Input
                value={form.kod}
                onChange={(event) => setForm((prev) => ({ ...prev, kod: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {locale === "ar" ? "كلمة المرور" : locale === "tr" ? "Şifre" : "Password"}
              </label>
              <Input
                type="password"
                value={form.sifre}
                onChange={(event) => setForm((prev) => ({ ...prev, sifre: event.target.value }))}
                required
              />
            </div>
          </div>
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {formError}
            </div>
          )}
          <Button type="submit" disabled={creating} className="w-full">
            {creating
              ? locale === "ar"
                ? "جاري الحفظ..."
                : locale === "tr"
                ? "Kaydediliyor..."
                : "Saving..."
              : locale === "ar"
              ? "حفظ بيانات الاعتماد"
              : locale === "tr"
              ? "Kimlik bilgisini kaydet"
              : "Save credential"}
          </Button>
        </form>
      )}
    </div>
  );
}
