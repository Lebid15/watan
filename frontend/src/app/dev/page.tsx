'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function DevHome() {
  return (
    <div className="space-y-4 text-gray-950">
      <h1 className="text-2xl font-bold">لوحة المطوّر</h1>
      <p className="text-zinc-700">
        راقب الاستيراد من المزوّدين وشاهد الكتالوج المركزي (منتجات/باقات). لا يوجد تداخل مع لوحة المشرف.
      </p>
      <ul className="list-disc ps-6 text-zinc-700">
        <li>اذهب إلى تبويب <b>المزوّدون</b> لاستيراد/تحديث الكتالوج من مزوّد معيّن.</li>
        <li>اذهب إلى تبويب <b>الكتالوج</b> لاستعراض المنتجات والباقة والتكاليف.</li>
      </ul>
    </div>
  );
}
