"use client";

import { useTranslations } from "next-intl";
import { Home, Bell, ShoppingCart, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations("bottomNav");
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: t("home"), href: "/" },
    { icon: ShoppingCart, label: t("orders"), href: "/orders" },
    { icon: Bell, label: t("notifications"), href: "/notifications" },
    { icon: Wallet, label: t("wallet"), href: "/wallet" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.match(/^\/[a-z]{2}$/);
    }
    return pathname.includes(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 md:hidden">
      <ul className="flex items-center justify-around h-16 px-6">
        {navItems.map((item, index) => {
          const active = isActive(item.href);
          return (
            <li key={index}>
              <Link
                href={item.href}
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
