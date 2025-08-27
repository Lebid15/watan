"use client";
import React,{useEffect,useState} from 'react';
import api from '@/utils/api';
import { formatMoney3 } from '@/utils/format';

interface Product { id:string; name:string; basePriceUsd?:number; }

export default function DistributorProducts(){
  const [rows,setRows]=useState<Product[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState<any>(null);
  useEffect(()=>{(async()=>{try{const r=await api.get('/distributor/products');setRows(r.data||[]);}catch(e:any){setErr(e);}finally{setLoading(false);} })();},[]);
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Products</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <table className="w-full text-sm border border-border"><thead className="bg-bg-surface-alt"><tr>
      <th className="p-2 text-right">Name</th>
      <th className="p-2 text-right">Base</th>
    </tr></thead><tbody>
      {rows.map(p=> <tr key={p.id} className="border-t border-border"><td className="p-2">{p.name}</td><td className="p-2 font-mono" dir="ltr">{formatMoney3(p.basePriceUsd||0)}</td></tr>)}
      {!loading && rows.length===0 && <tr><td colSpan={2} className="p-4 text-center opacity-60">No products</td></tr>}
    </tbody></table>
  </div>;
}
