import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/layout/main-layout";
import { getSidebarCollapsed } from "@/lib/cookies";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Tenants Dashboard - لوحة تحكم المستأجرين",
  description: "Next.js Tenants Dashboard with RTL Support",
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === 'ar';
  const sidebarCollapsed = await getSidebarCollapsed();

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <MainLayout initialSidebarCollapsed={sidebarCollapsed}>{children}</MainLayout>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
