"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/utils/api';
import { formatMoney3 } from '@/utils/format';

interface PackageRow { id:string; linkCode?:string; sellPriceUsd?:number; capitalPriceUsd?:number; }

export default function ProductPackages(){
  const { id } = useParams() as { id:string };
  const [rows,setRows]=useState<PackageRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<any>(null);
  useEffect(()=>{ if(!id) return; (async()=>{ try { const r = await api.get(`/products/${id}/packages`); const _raw=r.data;const _arr=Array.isArray(_raw)?_raw:(Array.isArray(_raw?.items)?_raw.items:[]);setRows(_arr);}catch(e:any){setErr(e);}finally{setLoading(false);} })(); },[id]);

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Packages</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <table className="w-full text-sm border border-border">
      <thead className="bg-bg-surface-alt"><tr>
        <th className="p-2 text-right">LinkCode</th>
        <th className="p-2 text-right">Sell</th>
        <th className="p-2 text-right">Capital</th>
      </tr></thead>
      <tbody>
        {rows.map(pk => <tr key={pk.id} className="border-t border-border">
          <td className="p-2 font-mono" dir="ltr">{pk.linkCode||'-'}</td>
            <td className="p-2 font-mono" dir="ltr">{formatMoney3(pk.sellPriceUsd||0)}</td>
            <td className="p-2 font-mono" dir="ltr">{formatMoney3(pk.capitalPriceUsd||0)}</td>
        </tr>)}
        {!loading && rows.length===0 && <tr><td className="p-4 text-center opacity-60" colSpan={3}>No packages</td></tr>}
      </tbody>
    </table>
  </div>;
}
