"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import {
  Package,
  ShoppingCart,
  CreditCard,
  Wallet,
  Plus,
  Shield,
  Code,
  Info,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import { useBackendSession } from "@/context/auth-session";

interface SidebarProps {
  mobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  initialCollapsed?: boolean;
  balanceValue?: number | null;
}

export function Sidebar({ mobileMenuOpen = false, onMobileMenuClose, onCollapsedChange, initialCollapsed = false, balanceValue }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const { theme, setTheme } = useTheme();
  const t = useTranslations("sidebar");
  const locale = useLocale();
  const pathname = usePathname();
  const isRTL = locale === "ar";
  const { user, status, connect } = useBackendSession();
  const hasBalance = typeof balanceValue === "number" && !Number.isNaN(balanceValue);
  const isPositive = (balanceValue ?? 0) >= 0;

  // Always format with English numerals regardless of locale
  const formatCurrency = (value: number) => {
    try {
      const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(value));
      return `${value < 0 ? "-" : ""}${formatted}$`;
    } catch {
      return `${value < 0 ? "-" : ""}${Math.abs(value).toFixed(2)}$`;
    }
  };

  useEffect(() => {
    // Notify parent about collapse state
    if (onCollapsedChange) {
      onCollapsedChange(isCollapsed);
    }
  }, [isCollapsed, onCollapsedChange]);

  const mounted = typeof window !== "undefined";

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Notify parent
    if (onCollapsedChange) {
      onCollapsedChange(newState);
    }
  };

  // Build locale-aware hrefs that omit the locale prefix for the default locale (localePrefix = "as-needed")
  const withLocale = (path: string) => {
    const isDefault = locale === routing.defaultLocale;
    // If default locale and prefix is as-needed, do not prefix
    return isDefault ? path : `/${locale}${path}`;
  };

  // Define menu items using locale-agnostic paths
  const menuItems = [
    { icon: Package, label: t("products"), path: "/" },
    { icon: ShoppingCart, label: t("orders"), path: "/orders" },
    { icon: CreditCard, label: t("payments"), path: "/payments" },
    { icon: Wallet, label: t("wallet"), path: "/wallet" },
    { icon: Plus, label: t("addBalance"), path: "/add-balance" },
    { icon: Shield, label: t("protection"), path: "/protection" },
    { icon: Code, label: t("api"), path: "/api" },
    { icon: Info, label: t("about"), path: "/about" },
  ];

  const isActive = (basePath: string) => {
    // Normalize helpers
    const normalize = (p: string) => (p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p);
    const current = normalize(pathname);

    // Candidates: locale-less and locale-prefixed
    const candidateA = normalize(basePath); // e.g. /orders
    const candidateB = normalize(withLocale(basePath)); // e.g. /ar/orders (or /orders for default)

    // Special case: home
    if (candidateA === "/") {
      return current === "/" || current === candidateB;
    }

    // Match exact or nested paths for either candidate
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
            {user?.name || user?.email || t("guest")}
          </h3>
          <p className="text-sm text-muted-foreground">{user?.tenantId ?? "tenant"}</p>
          
          {/* Wallet Balance */}
          {hasBalance ? (
            <div className="flex items-center gap-2 mt-3 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/40">
            <Wallet className="h-6 w-6 text-primary flex-shrink-0 drop-shadow-[0_0_12px_rgba(241,149,8,0.4)]" />
              <span className={cn("font-bold text-sm", isPositive ? "text-emerald-400" : "text-red-500")}>{formatCurrency(balanceValue ?? 0)}</span>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-3 w-full border-primary/60 text-primary"
              onClick={() => connect()}
              disabled={status === "connecting"}
            >
              {status === "connecting" ? t("connecting") : t("connectAccount")}
            </Button>
          )}
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
          
          {/* Settings */}
          <li>
            <Link href={withLocale("/settings")}>
              <Button
                variant="ghost"
                onClick={handleNavItemClick}
                className={cn(
                  "w-full justify-start gap-3 h-11 hover:bg-sidebar-accent hover:text-primary transition-all cursor-pointer",
                  isCollapsed && "justify-center px-0",
                  isActive("/settings") && "border border-primary/80 bg-primary/10 shadow-[0_0_18px_rgba(241,149,8,0.2)]"
                )}
              >
                <Settings className="size-6 flex-shrink-0 text-primary drop-shadow-[0_0_12px_rgba(241,149,8,0.4)]" />
                <span
                  className={cn(
                    "transition-all duration-300",
                    isCollapsed && "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  {t("settings")}
                </span>
              </Button>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
    </>
  );
}
