"use client";
import React,{useEffect,useState} from 'react';
import api from '@/utils/api';
import { formatMoney3 } from '@/utils/format';

interface OrderRow { id:string; capitalUsd:number; sellUsd:number; profitUsd:number; distCurrencyCodeAtOrder?:string; createdAt:string; }

export default function DistributorOrdersPage(){
  const [rows,setRows]=useState<OrderRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<any>(null);
  const [page,setPage]=useState(0); const limit=20;
  useEffect(()=>{(async()=>{setLoading(true);try{const r=await api.get(`/distributor/orders?limit=${limit}&offset=${page*limit}`);setRows(r.data?.items||[]);}catch(e:any){setErr(e);}finally{setLoading(false);} })();},[page]);
  const totals=rows.reduce((a,r)=>{a.cap+=r.capitalUsd||0;a.sell+=r.sellUsd||0;a.profit+=r.profitUsd||((r.sellUsd||0)-(r.capitalUsd||0));return a;},{cap:0,sell:0,profit:0});
  return <div className="space-y-4"><h1 className="text-xl font-semibold">Distributor Orders</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <table className="w-full text-sm border border-border"><thead className="bg-bg-surface-alt"><tr>
      <th className="p-2 text-right">ID</th>
      <th className="p-2 text-right">Capital</th>
      <th className="p-2 text-right">Sell</th>
      <th className="p-2 text-right">Profit</th>
      <th className="p-2 text-right">Currency</th>
      <th className="p-2 text-right">Date</th>
    </tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-t border-border">
        <td className="p-2 font-mono" dir="ltr">{r.id}</td>
        <td className="p-2 font-mono" dir="ltr">{formatMoney3(r.capitalUsd)}</td>
        <td className="p-2 font-mono" dir="ltr">{formatMoney3(r.sellUsd)}</td>
        <td className="p-2 font-mono" dir="ltr">{formatMoney3(r.profitUsd||((r.sellUsd||0)-(r.capitalUsd||0)))}</td>
        <td className="p-2" dir="ltr">{r.distCurrencyCodeAtOrder||'USD'}</td>
        <td className="p-2 text-xs" dir="ltr">{r.createdAt?.slice(0,19).replace('T',' ')}</td>
      </tr>)}
      {!loading && rows.length===0 && <tr><td colSpan={6} className="p-4 text-center opacity-60">No orders</td></tr>}
    </tbody></table>
    <div className="flex items-center gap-3 text-xs"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="btn btn-xs">Prev</button><span>Page {page+1}</span><button disabled={rows.length<limit} onClick={()=>setPage(p=>p+1)} className="btn btn-xs">Next</button><div className="ml-auto flex gap-4 font-mono" dir="ltr"><span>ΣCap {formatMoney3(totals.cap)}</span><span>ΣSell {formatMoney3(totals.sell)}</span><span>ΣProfit {formatMoney3(totals.profit)}</span></div></div>
  </div>;
}
