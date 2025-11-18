import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenants Dashboard - لوحة تحكم المستأجرين",
  description: "Next.js Tenants Dashboard with RTL Support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
