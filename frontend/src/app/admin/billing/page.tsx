"use client";
import { useEffect, useState } from 'react';
import { adminListTenants } from '@/utils/billingApi';
import { formatMoney3 } from '@/utils/format';
import { useT } from '@/i18n';
import Link from 'next/link';

export default function AdminBillingTenants(){
  const t=useT();
  const [items,setItems]=useState<any[]>([]); const [total,setTotal]=useState(0); const [limit,setLimit]=useState(20); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true);
  useEffect(()=>{const token=localStorage.getItem('token'); if(!token){setLoading(false);return;} setLoading(true); adminListTenants(token,limit,offset).then((r:any)=>{setItems(r.data.items||[]); setTotal(r.data.total||0);}).finally(()=>setLoading(false));},[limit,offset]);
  const pages=Math.ceil(total/limit)||1; const page=Math.floor(offset/limit)+1;
  return <div className="p-4 space-y-4 text-xs">
    <div className="flex justify-between items-center"><div className="font-bold">{t('billing.title')}</div><div>{page}/{pages}</div></div>
    <table className="w-full border border-border"><thead className="bg-bg-surface-alt"><tr><Th>Code</Th><Th>Name</Th><Th>Status</Th><Th>Open</Th><Th>Overdue</Th><Th>Last</Th></tr></thead><tbody>{items.map(r=> <tr key={r.tenantId} className="border-t border-border"><Td><Link className="text-primary" href={`/admin/billing/${r.tenantId}`}>{r.tenantId.slice(0,6)}</Link></Td><Td>{r.tenantName||'-'}</Td><Td>{r.status}</Td><Td>{r.openInvoices}</Td><Td>{r.overdueOpenInvoices}</Td><Td dir="ltr">{r.lastInvoiceAmountUSD3||'-'}</Td></tr>)}{!items.length && <tr><Td colSpan={6} className="text-center py-4 opacity-60">—</Td></tr>}</tbody></table>
    <div className="flex gap-2"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-limit))} className="px-3 py-1 rounded bg-bg-surface-alt border border-border disabled:opacity-40">Prev</button><button disabled={offset+limit>=total} onClick={()=>setOffset(offset+limit)} className="px-3 py-1 rounded bg-bg-surface-alt border border-border disabled:opacity-40">Next</button></div>
  </div>;
}
const Th=(p:any)=><th className="text-right p-2 font-medium border-l border-border" {...p}/>; const Td=(p:any)=><td className="p-2 align-top" {...p}/>;
