'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { useState } from 'react';
import api from '@/utils/api';

export default function DevNewProductPage(){
  const [name,setName]=useState('');
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState<string|null>(null);
  const [err,setErr]=useState<string|null>(null);

  const submit= async(e:React.FormEvent)=>{
    e.preventDefault(); if(!name.trim()) return;
    setSaving(true); setMsg(null); setErr(null);
    try {
      // مبدئياً نستدعي مسار تنفيذي إداري (يمكن تغييره لاحقاً لمسار dev)
      await api.post('/admin/catalog/products',{ name: name.trim(), linkCodes: [] });
      setMsg('تم إنشاء المنتج (مؤقتاً)');
      setName('');
    } catch(e:any){ setErr(e?.message||'فشل الإنشاء'); }
    finally{ setSaving(false); }
  };

  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>إضافة منتج من الصفر</h1>
      <form onSubmit={submit} className='space-y-3 max-w-md'>
        <div>
          <label className='block mb-1 text-sm'>اسم المنتج</label>
          <input value={name} onChange={e=>setName(e.target.value)} className='border rounded w-full px-3 py-2 text-sm' placeholder='اسم...' />
        </div>
        <button disabled={saving||!name.trim()} className='px-4 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-50'>حفظ</button>
        {msg && <div className='text-sm text-green-600'>{msg}</div>}
        {err && <div className='text-sm text-red-600'>{err}</div>}
      </form>
      <p className='text-xs text-gray-500'>هذه صفحة مبدئية. لاحقاً سنربطها بمخطط خصائص كامل للمنتجات وواجهة رفع الصور.</p>
    </div>
  );
}
