'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function CatalogImagesRemoved() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">تم إيقاف صفحة صور الكتالوج</h1>
      <p className="text-sm text-gray-600">أزيل منطق الكتالوج ولا تتوفر إدارة الصور هنا بعد الآن.</p>
      <p className="text-xs text-gray-400">(placeholder to avoid legacy imports)</p>
    </div>
  );
}
