"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

interface Pkg { id:string; name:string|null; publicCode:number|null; basePrice?:number; isActive?:boolean; }
interface Product { id:string; name:string; description?:string; packages:Pkg[] }

export const dynamic = 'force-dynamic';

export default function DevEditProductPage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [product,setProduct]=useState<Product|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load = useCallback(async()=>{
    if(!id) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/products/${id}?all=1`);
      setProduct(res.data);
    }catch(e:any){ setError(e?.response?.data?.message||e?.message||'Failed'); }
    finally{ setLoading(false); }
  },[id]);

  useEffect(()=>{ load(); },[load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.back()} className="text-xs px-3 py-1 bg-gray-200 rounded">رجوع</button>
        <h1 className="text-xl font-bold">تعديل المنتج</h1>
      </div>
      {loading && <div className="text-sm">تحميل...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {product && (
        <div className="space-y-4">
          <div className="p-3 border rounded bg-white">
            <div className="font-semibold mb-2">{product.name}</div>
            <div className="text-xs text-gray-600">ID: {product.id}</div>
            <div className="text-xs text-gray-600">الوصف: {product.description||'-'}</div>
            {/* TODO: add editable inputs & save action */}
          </div>
          <div className="p-3 border rounded bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">الباقات ({product.packages.length})</h2>
              {/* TODO: add button to add new package */}
            </div>
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-right">#</th>
                  <th className="px-2 py-1 text-right">الاسم</th>
                  <th className="px-2 py-1 text-right">الكود</th>
                  <th className="px-2 py-1 text-right">السعر</th>
                  <th className="px-2 py-1 text-right">نشط</th>
                </tr>
              </thead>
              <tbody>
                {product.packages.map((pk,i)=>(
                  <tr key={pk.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">{pk.name}</td>
                    <td className="px-2 py-1">{pk.publicCode ?? '-'}</td>
                    <td className="px-2 py-1">{pk.basePrice ?? '-'}</td>
                    <td className="px-2 py-1">{pk.isActive ? '✓':'✗'}</td>
                    {/* TODO: per-package edit / toggle active */}
                  </tr>
                ))}
                {product.packages.length===0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-400">لا توجد باقات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
