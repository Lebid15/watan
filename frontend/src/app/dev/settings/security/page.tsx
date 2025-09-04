'use client';
export const dynamic = 'force-dynamic'; // منع أي محاولة pre-render
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';

// استيراد الصفحة الأصلية كعميل فقط بدون SSR لتفادي متطلبات السيرفر أو أي revalidate ضمني
const SecurityImpl = nextDynamic(() => import('@/app/security/page'), { ssr: false });

export default function DevSecurityPage() {
	return (
		<Suspense fallback={null}>
			<SecurityImpl />
		</Suspense>
	);
}
