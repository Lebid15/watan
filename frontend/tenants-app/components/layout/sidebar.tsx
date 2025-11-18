"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  Truck,
  Users,
  CreditCard,
  FileText,
  Settings as SettingsIcon,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { routing } from "@/i18n/routing";

interface SidebarProps {
  className?: string;
  mobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  initialCollapsed?: boolean;
}

export function Sidebar({ className, mobileMenuOpen = false, onMobileMenuClose, onCollapsedChange, initialCollapsed = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const t = useTranslations("sidebar");
  const locale = useLocale();
  const pathname = usePathname();
  const isRTL = locale === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Notify parent about collapse state
    if (onCollapsedChange) {
      onCollapsedChange(isCollapsed);
    }
  }, [isCollapsed, onCollapsedChange]);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Notify parent
    if (onCollapsedChange) {
      onCollapsedChange(newState);
    }
  };

  // Locale-aware hrefs (localePrefix = "as-needed")
  const withLocale = (path: string) => {
    const isDefault = locale === routing.defaultLocale;
    return isDefault ? path : `/${locale}${path}`;
  };

  const menuItems = [
    { icon: ShoppingCart, label: t("orders"), path: "/orders" },
    { icon: Package, label: t("products"), path: "/products" },
    { icon: Truck, label: t("suppliers"), path: "/suppliers" },
    { icon: Users, label: t("users"), path: "/users" },
    { icon: CreditCard, label: t("payments"), path: "/payments" },
    { icon: FileText, label: t("reports"), path: "/reports" },
    { icon: SettingsIcon, label: t("settings"), path: "/settings" },
  ];

  const isActive = (basePath: string) => {
    const normalize = (p: string) => (p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p);
    const current = normalize(pathname);
    const candidateA = normalize(basePath);
    const candidateB = normalize(withLocale(basePath));
    return (
      current === candidateA ||
      current.startsWith(candidateA + "/") ||
      current === candidateB ||
      current.startsWith(candidateB + "/")
    );
  };

  const handleNavItemClick = () => {
    if (mobileMenuOpen && onMobileMenuClose) {
      onMobileMenuClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileMenuClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 h-screen bg-sidebar border-sidebar-border transition-all duration-300 z-50 flex flex-col",
          isRTL ? "right-0 border-l" : "left-0 border-r",
          isCollapsed ? "w-16" : "w-56",
          // Mobile visibility
          mobileMenuOpen
            ? "translate-x-0"
            : isRTL
            ? "translate-x-full md:translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCollapse}
          className="flex-shrink-0"
        >
          {isRTL ? (
            isCollapsed ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )
          ) : isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
        
        <div
          className={cn(
            "flex-1 transition-all duration-300",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}
        >
          <h3 className="font-bold text-lg text-sidebar-foreground">
            {locale === "ar" ? "محمد أحمد" : locale === "tr" ? "Muhammed Ahmed" : "Mohammed Ahmed"}
          </h3>
          <p className="text-sm text-muted-foreground">#12345</p>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const href = withLocale(item.path);
            const active = isActive(item.path);
            return (
              <li key={index}>
                <Link href={href}>
                  <Button
                    variant="ghost"
                    onClick={handleNavItemClick}
                    className={cn(
                      "w-full justify-start gap-3 h-11 hover:bg-sidebar-accent hover:text-primary transition-all cursor-pointer",
                      isCollapsed && "justify-center px-0",
                      active && "border border-primary/80 bg-primary/10 shadow-[0_0_18px_rgba(241,149,8,0.2)]"
                    )}
                  >
                    <item.icon className="size-6 flex-shrink-0 text-primary drop-shadow-[0_0_12px_rgba(241,149,8,0.4)]" />
                    <span
                      className={cn(
                        "transition-all duration-300",
                        isCollapsed && "opacity-0 w-0 overflow-hidden"
                      )}
                    >
                      {item.label}
                    </span>
                  </Button>
                </Link>
              </li>
            );
          })}
          
          {/* Theme Toggle */}
          <li className="pt-2 border-t border-sidebar-border mt-2">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-11 hover:bg-sidebar-accent hover:text-primary transition-all cursor-pointer",
                isCollapsed && "justify-center px-0"
              )}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              suppressHydrationWarning
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="size-6 flex-shrink-0 text-primary drop-shadow-[0_0_12px_rgba(241,149,8,0.4)]" />
                ) : (
                  <Moon className="size-6 flex-shrink-0 text-primary drop-shadow-[0_0_12px_rgba(241,149,8,0.4)]" />
                )
              ) : (
                <div className="size-6 flex-shrink-0" />
              )}
              <span
                className={cn(
                  "transition-all duration-300",
                  isCollapsed && "opacity-0 w-0 overflow-hidden"
                )}
              >
                {t("toggleTheme")}
              </span>
            </Button>
          </li>
        </ul>
      </nav>
    </aside>
    </>
  );
}
