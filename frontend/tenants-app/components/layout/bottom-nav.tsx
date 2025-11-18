"use client";

import { useTranslations, useLocale } from "next-intl";
import { ShoppingCart, Package, CreditCard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { routing } from "@/i18n/routing";

export function BottomNav() {
  const t = useTranslations("sidebar");
  const locale = useLocale();
  const pathname = usePathname();
  const isDefaultLocale = locale === routing.defaultLocale;

  const withLocale = (path: string) => (isDefaultLocale ? path : `/${locale}${path}`);

  const navItems = [
    { icon: ShoppingCart, label: t("orders"), href: "/orders" },
    { icon: Package, label: t("products"), href: "/products" },
    { icon: CreditCard, label: t("payments"), href: "/payments" },
    { icon: Settings, label: t("settings"), href: "/settings" },
  ];

  const isActive = (href: string) => {
    const target = withLocale(href);
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 md:hidden">
      <ul className="flex items-center justify-around h-16 px-6">
        {navItems.map((item, index) => {
          const target = withLocale(item.href);
          const active = isActive(item.href);

          return (
            <li key={index}>
              <Link
                href={target}
                className={cn(
                  "flex items-center justify-center p-3 rounded-lg transition-all hover:bg-primary/10",
                  active && "border border-primary/80 bg-primary/10 shadow-[0_0_16px_rgba(241,149,8,0.2)]"
                )}
              >
                <item.icon
                  className={cn(
                    "w-6 h-6 text-primary transition-all",
                    !active && "opacity-70"
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
