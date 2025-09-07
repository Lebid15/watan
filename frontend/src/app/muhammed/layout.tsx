import React from 'react';

export default function MuhLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-lg p-4 md:p-6 font-sans text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide text-slate-100">منطقة محمد الخاصة</h1>
        <nav className="text-sm space-x-3 rtl:space-x-reverse">
          <a className="text-indigo-300 hover:text-white" href="/muhammed/sheet">الورقة</a>
          <a className="text-indigo-300 hover:text-white" href="/muhammed/exports">التصديرات</a>
        </nav>
      </div>
      {children}
    </div>
  );
}
