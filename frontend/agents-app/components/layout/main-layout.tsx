"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { cn } from "@/lib/utils";
import { useZNetData } from "@/hooks/useZNetData";
import { useProviderCredentialContext } from "@/hooks/useProviderCredentials";

interface MainLayoutProps {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}

export function MainLayout({ children, initialSidebarCollapsed = false }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { selectedCredentialId } = useProviderCredentialContext();
  const { balance } = useZNetData(true, selectedCredentialId);

  const handleSidebarCollapsedChange = async (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    // Update cookie
    document.cookie = `sidebarCollapsed=${collapsed}; path=/; max-age=${60 * 60 * 24 * 365}`;
  };

  return (
    <div className="min-h-screen relative">
      <Sidebar 
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
        onCollapsedChange={handleSidebarCollapsedChange}
        initialCollapsed={initialSidebarCollapsed}
        balanceValue={balance?.balance ?? null}
      />
      <Header 
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      
      <main
        className={cn(
          "pt-16 pb-16 md:pb-0 transition-all duration-300 min-h-screen",
          isRTL
            ? sidebarCollapsed
              ? "md:mr-16"
              : "md:mr-56"
            : sidebarCollapsed
            ? "md:ml-16"
            : "md:ml-56"
        )}
      >
        <div className="container mx-auto p-6">{children}</div>
      </main>
      
      <BottomNav />
    </div>
  );
}
