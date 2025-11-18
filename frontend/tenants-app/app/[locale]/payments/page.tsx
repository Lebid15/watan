"use client";

import { useTranslations } from "next-intl";

export default function PaymentsPage() {
  const t = useTranslations("pages.payments");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--gold)' }}>
        {t("title")}
      </h1>
    </div>
  );
}
