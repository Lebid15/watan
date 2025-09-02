'use client';
import React from 'react';

export default function PasskeysError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="admin-container py-10 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">تعذّر تحميل مفاتيح المرور</h1>
      <p className="text-sm text-text-secondary mb-6">حدث خطأ غير متوقع أثناء تحميل الصفحة.</p>
      <pre className="text-xs bg-bg-surface-alt p-3 rounded border border-border overflow-auto mb-6 rtl:text-right" dir="ltr">{error.message}</pre>
      <button
        onClick={() => reset()}
        className="bg-primary text-white text-sm px-4 py-2 rounded hover:brightness-110"
      >إعادة المحاولة</button>
    </div>
  );
}
