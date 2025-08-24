'use client';
import { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

export default function Page() {
  const [text, setText] = useState('');
  useEffect(() => {
    api.get<string>(API_ROUTES.site.public.about).then(r => setText(r.data || ''));
  }, []);
  return (
    <div className="p-4" dir="rtl">
      <h1 className="text-lg font-bold mb-3">من نحن</h1>
      <div className="whitespace-pre-wrap text-text-primary">{text}</div>
    </div>
  );
}
