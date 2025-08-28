"use client";
import { useEffect, useState } from 'react';
import api from '@/utils/api';

interface DistOrder {
  id: string;
  capitalUsd?: number;
  sellUsd?: number;
  profitUsd?: number;
  createdAt?: string;
}

export default function DistributorOrdersPage() {
  const [rows,setRows]=useState<DistOrder[]>([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState<any>(null);
  const [page,setPage]=useState(0);
  const limit=20;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const r = await api.get(`/distributor/orders?limit=${limit}&offset=${page*limit}`);
        const raw:any = r.data;
        let arr:DistOrder[] = [];
        if (Array.isArray(raw)) arr = raw;
        else if (raw && typeof raw==='object' && Array.isArray(raw.items)) arr = raw.items;
        setRows(arr);
      } catch(e:any){
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  },[page]);

  const totals = rows.reduce((a,r)=>{
    a.cap += r.capitalUsd||0;
    a.sell += r.sellUsd||0;
    a.profit += r.profitUsd || ((r.sellUsd||0)-(r.capitalUsd||0));
    return a;
  },{cap:0,sell:0,profit:0});

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Distributor Orders</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-red-500 text-sm">Error</div>}
    <div className="text-sm opacity-70">Page {page+1}</div>
    <table className="w-full text-sm border border-border">
      <thead className="bg-bg-surface-alt">
        <tr>
          <th className="p-2 text-left">ID</th>
          <th className="p-2 text-right">Capital</th>
          <th className="p-2 text-right">Sell</th>
          <th className="p-2 text-right">Profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r=> <tr key={r.id} className="border-t border-border">
          <td className="p-2">{r.id}</td>
          <td className="p-2 text-right">{(r.capitalUsd||0).toFixed(2)}</td>
            <td className="p-2 text-right">{(r.sellUsd||0).toFixed(2)}</td>
            <td className="p-2 text-right">{(r.profitUsd || ((r.sellUsd||0)-(r.capitalUsd||0))).toFixed(2)}</td>
        </tr>)}
        {!rows.length && !loading && <tr><td colSpan={4} className="p-3 text-center text-xs opacity-60">No orders</td></tr>}
      </tbody>
      <tfoot className="bg-bg-surface-alt border-t border-border">
        <tr>
          <td className="p-2 font-semibold">Totals</td>
          <td className="p-2 text-right font-semibold">{totals.cap.toFixed(2)}</td>
          <td className="p-2 text-right font-semibold">{totals.sell.toFixed(2)}</td>
          <td className="p-2 text-right font-semibold">{totals.profit.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <div className="flex gap-2">
      <button disabled={page===0 || loading} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Prev</button>
      <button disabled={loading || rows.length<limit} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Next</button>
    </div>
  </div>;
}
