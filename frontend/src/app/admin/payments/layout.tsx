'use client';

import PaymentsNavbar from './PaymentsNavbar';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      {/* ملاحظة: AdminNavbar يأتي من /admin/layout.tsx (الأب) */}
      <PaymentsNavbar />
      <main className="max-w-7xl mx-auto p-4">{children}</main>
    </div>
  );
}
