"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const t = useTranslations("search");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <div className="relative w-full">
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          isRTL ? "right-4" : "left-4"
        )}
      >
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        className={cn(
          "w-full h-12 rounded-xl border-2 border-border bg-card text-foreground",
          "focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20",
          "transition-all duration-200 shadow-sm",
          isRTL ? "pr-12 pl-4" : "pl-12 pr-4"
        )}
      />
    </div>
  );
}
