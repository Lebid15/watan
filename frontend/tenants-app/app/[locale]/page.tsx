"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";

export default function HomePage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/orders`);
  }, [router, locale]);

  return null;
}
