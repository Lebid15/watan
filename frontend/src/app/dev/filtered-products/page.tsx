'use client';
import { useEffect, useState } from 'react';
import api from '@/utils/api';

interface ProductRow { id:string; name:string; code?:string; provider?:string; baseCost?:number; enabled?:boolean; }

export default function DevFilteredProductsPage(){
  const [q,setQ]=useState('');
  const [rows,setRows]=useState<ProductRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load= async()=>{
    setLoading(true); setError(null);
    try {
      // مؤقت: نستخدم endpoint الكتالوج الإداري مع باراميتر q (لو مدعوم)
      const res = await api.get(`/admin/catalog/products?withCounts=1${q?`&q=${encodeURIComponent(q)}`:''}`);
      const list = (res.data?.items || res.data || []).map((p:any)=>({
        id: p.id, name: p.name, code: p.code, provider: p.providerName || p.provider?.name, baseCost: p.baseCost, enabled: p.enabled
      }));
      setRows(list);
    } catch(e:any){ setError(e?.message||'فشل التحميل'); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>منتجات مُفلترة (Dev)</h1>
      <div className='flex gap-2'>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder='بحث...' className='border rounded px-3 py-1 text-sm'/>
        <button onClick={load} disabled={loading} className='px-4 py-1.5 rounded bg-red-600 text-white text-sm disabled:opacity-50'>تحديث</button>
      </div>
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <div className='overflow-auto border rounded'>
        <table className='min-w-full text-sm'>
          <thead className='bg-gray-100'>
            <tr>
              <th className='px-2 py-1 text-right'>#</th>
              <th className='px-2 py-1 text-right'>الاسم</th>
              <th className='px-2 py-1 text-right'>الكود</th>
              <th className='px-2 py-1 text-right'>المزوّد</th>
              <th className='px-2 py-1 text-right'>التكلفة</th>
              <th className='px-2 py-1 text-right'>حالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={r.id} className='odd:bg-white even:bg-gray-50 hover:bg-yellow-50'>
                <td className='px-2 py-1'>{i+1}</td>
                <td className='px-2 py-1 font-medium'>{r.name}</td>
                <td className='px-2 py-1'>{r.code||'-'}</td>
                <td className='px-2 py-1'>{r.provider||'-'}</td>
                <td className='px-2 py-1'>{r.baseCost??'-'}</td>
                <td className='px-2 py-1'>{r.enabled? '✓':'✗'}</td>
              </tr>
            ))}
            {!loading && rows.length===0 && <tr><td colSpan={6} className='text-center py-6 text-gray-500'>لا توجد نتائج</td></tr>}
            {loading && <tr><td colSpan={6} className='text-center py-6 animate-pulse'>...تحميل</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
