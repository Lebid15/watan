import React from 'react';

// ملاحظة: جعل المنطقة مضغوطة عبر تصغير المقاسات والخطوط افتراضياً
export default function MuhLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-lg p-3 md:p-4 font-sans text-slate-100 text-[12px] leading-relaxed">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-base md:text-lg font-semibold tracking-wide text-slate-100">منطقة محمد الخاصة</h1>
        <nav className="space-x-2 rtl:space-x-reverse text-[11px] md:text-xs">
          <a className="text-indigo-300 hover:text-white" href="/muhammed/sheet">الورقة</a>
          <a className="text-indigo-300 hover:text-white" href="/muhammed/exports">التصديرات</a>
        </nav>
      </div>
      <div className="muh-compact space-y-3">{children}</div>
    </div>
  );
}
