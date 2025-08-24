'use client';

import ReportsNavbar from './ReportsNavbar';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <ReportsNavbar />
      <div className="max-w-7xl mx-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
}
