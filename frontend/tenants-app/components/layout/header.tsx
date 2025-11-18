"use client";

import { useLocale } from "next-intl";
import { Menu, X, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRouter, usePathname } from "@/i18n/routing";

interface HeaderProps {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function Header({ sidebarCollapsed, mobileMenuOpen, onMobileMenuToggle }: HeaderProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();

  const changeLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as any });
  };

  return (
    <header
      className={cn(
        "fixed top-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-6 transition-all duration-300",
        // Hide on mobile (full width), adjust for sidebar on md and up
        "left-0 right-0 md:left-0 md:right-0",
        isRTL
          ? sidebarCollapsed
            ? "md:right-16"
            : "md:right-56"
          : sidebarCollapsed
          ? "md:left-16"
          : "md:left-56"
      )}
    >
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMobileMenuToggle}
        className="md:hidden hover:bg-gold/10"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6 text-gold" />
        ) : (
          <Menu className="h-6 w-6 text-gold" />
        )}
      </Button>

      <div className="flex-1 md:flex-none" />

      {/* Logo and Brand Name */}
      <div className="flex items-center gap-3">
        {/* Language Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="!bg-card border border-border/60 rounded-full shadow-sm !hover:bg-card/80 hover:border-gold/50 transition-colors"
            >
              <Languages className="h-5 w-5 text-gold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[80px]">
            <DropdownMenuItem 
              onClick={() => changeLocale('ar')}
              className={cn(
                "cursor-pointer justify-center font-semibold",
                locale === 'ar' && "bg-gold/10 text-gold"
              )}
            >
              AR
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => changeLocale('en')}
              className={cn(
                "cursor-pointer justify-center font-semibold",
                locale === 'en' && "bg-gold/10 text-gold"
              )}
            >
              EN
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => changeLocale('tr')}
              className={cn(
                "cursor-pointer justify-center font-semibold",
                locale === 'tr' && "bg-gold/10 text-gold"
              )}
            >
              TR
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="relative w-10 h-10 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="WTN"
            fill
            className="object-contain"
            sizes="40px"
            priority
          />
        </div>
        <h1 className="text-lg md:text-xl font-bold text-foreground hidden sm:block">
        WTN
        </h1>
      </div>
    </header>
  );
}
