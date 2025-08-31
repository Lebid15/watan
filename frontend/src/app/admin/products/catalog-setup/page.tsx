'use client';

// هذه الصفحة أزيلت وظائف الكتالوج القديمة.
// تركنا Placeholder لتجنب أخطاء البناء بعد حذف API_ROUTES.admin.catalog.
import Link from 'next/link';

export default function CatalogSetupRemovedPage(){
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">تم إيقاف صفحة إعداد الكتالوج</h1>
      <p className="text-sm text-gray-600">تم إزالة منطق الكتالوج الخارجي. لا حاجة لهذه الصفحة الآن.</p>
      <Link href="/admin/products" className="text-blue-600 underline text-sm">رجوع إلى المنتجات</Link>
    </div>
  );
}
