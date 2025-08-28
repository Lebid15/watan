"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTenantInvoices } from '@/utils/billingApi';
import { formatMoney3 } from '@/utils/format';
import { useT } from '@/i18n';

export const dynamic = 'force-dynamic';

export default function BillingInvoicesPage(){
  return <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><InvoicesInner/></Suspense>;
}

function InvoicesInner(){
  const t=useT();
  const sp=useSearchParams();
  const router=useRouter();
  const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState<any>(null);
  const status=sp.get('status')||''; const overdue=sp.get('overdue')==='true';
  useEffect(()=>{const token=localStorage.getItem('token'); if(!token){setLoading(false);return;} setLoading(true); getTenantInvoices(token,{status:status||undefined,overdue}).then((r:any)=>setItems(r.data.items||[])).catch(e=>setErr(e)).finally(()=>setLoading(false));},[status,overdue]);
  return <div className="p-4 space-y-4 text-sm">
    <Filters status={status} overdue={overdue} onChange={(nx)=>{const u=new URLSearchParams(); if(nx.status)u.set('status',nx.status); if(nx.overdue)u.set('overdue','true'); router.push('/billing/invoices'+(u.toString()?`?${u}`:''));}} />
    {loading && <div>{t('billing.loading')}</div>}
    {err && <div className="text-red-500">{t('common.error')}</div>}
    {!loading && !err && <table className="w-full border border-border">
      <thead className="bg-bg-surface-alt">
        <tr>
          <Th>{t('billing.periodStart')}</Th>
          <Th>{t('billing.periodEnd')}</Th>
          <Th>{t('billing.amount')}</Th>
          <Th>{t('billing.status.open')}</Th>
          <Th>{t('billing.dueAt')}</Th>
        </tr>
      </thead>
      <tbody>
        {items.map(inv=> <tr key={inv.id} className="border-t border-border">
          <Td>{inv.periodStart?.slice(0,10)}</Td>
          <Td>{inv.periodEnd?.slice(0,10)}</Td>
          <Td dir="ltr">{formatMoney3(inv.amountUsd)}</Td>
          <Td>{inv.status}</Td>
          <Td>{inv.dueAt?.slice(0,10)}</Td>
        </tr>)}
        {!items.length && <tr><Td colSpan={5} className="text-center py-4 opacity-60">—</Td></tr>}
      </tbody>
    </table>}
  </div>;
}
function Filters({status,overdue,onChange}:{status:string;overdue:boolean;onChange:(v:{status:string;overdue:boolean})=>void}){return <div className="flex gap-2 items-center flex-wrap"><select value={status} onChange={e=>onChange({status:e.target.value,overdue})} className="bg-bg-surface-alt border border-border rounded px-2 py-1"><option value="">ALL</option><option value="open">OPEN</option><option value="paid">PAID</option><option value="overdue">OVERDUE</option></select><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={overdue} onChange={e=>onChange({status,overdue:e.target.checked})}/> overdue</label></div>;}
const Th=(p:any)=><th className="text-right p-2 font-medium border-l border-border text-xs" {...p}/>; const Td=(p:any)=><td className="p-2 align-top text-xs" {...p}/>;
