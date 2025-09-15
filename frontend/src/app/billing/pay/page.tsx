"use client";
import { useState, useEffect } from 'react';
import { requestBillingPayment } from '@/utils/billingApi';
import { useT } from '@/i18n';
import api, { API_ROUTES } from '@/utils/api';
import SuspendedBanner from '@/components/billing/SuspendedBanner';

export default function BillingPayPage(){
  const t=useT();
  const [amount,setAmount]=useState('');
  const [methodId,setMethodId]=useState('');
  const [invoiceId,setInvoiceId]=useState('');
  const [res,setRes]=useState<any>(null); const [err,setErr]=useState<any>(null); const [loading,setLoading]=useState(false);
  const [methods,setMethods]=useState<any[]>([]); const [invoices,setInvoices]=useState<any[]>([]); const [suspended,setSuspended]=useState(false);
  const token=typeof window!=='undefined'?localStorage.getItem('token'):null;
  useEffect(()=>{ if(!token) return; (async()=>{ try{ const pm:any=await api.get(API_ROUTES.admin.paymentMethods.base,{ headers:{ Authorization:`Bearer ${token}` }}); setMethods((pm.data as any)||[]);}catch{} try{ const B:any=(API_ROUTES as any).billing||{}; const invFn=B.invoices; const inv:any=await api.get(invFn?invFn({ status:'open'}):undefined,{ headers:{ Authorization:`Bearer ${token}` }}); const raw=(inv.data as any); const items=Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:[]); setInvoices(items);}catch(e:any){ if(e?.response?.status===403 && e?.response?.data?.code==='TENANT_SUSPENDED') setSuspended(true);} })(); },[token]);
  const submit=async(e:any)=>{e.preventDefault(); if(!token)return; setLoading(true); setErr(null); setRes(null); try{const r=await requestBillingPayment(token,{amountUsd:Number(amount),methodId,invoiceId:invoiceId||undefined}); setRes(r.data);}catch(ex:any){setErr(ex);}finally{setLoading(false);} };
  return <div className="p-4 max-w-md space-y-4">
    {suspended && <SuspendedBanner />}
    {!methods.length && !suspended && <div className="bg-yellow-600 text-white p-3 rounded text-sm">{t('billing.pay.noMethods')}</div>}
    <form onSubmit={submit} className="space-y-3 bg-bg-surface-alt p-4 rounded border border-border">
      <div className="flex flex-col gap-1"><label className="text-xs">{t('billing.pay.amount')}</label><input value={amount} onChange={e=>setAmount(e.target.value)} required type="number" min="0.001" step="0.001" className="px-2 py-1 rounded bg-bg-surface border border-border"/></div>
      <div className="flex flex-col gap-1"><label className="text-xs">{t('billing.pay.methodId')}</label>
        <select value={methodId} onChange={e=>setMethodId(e.target.value)} required className="px-2 py-1 rounded bg-bg-surface border border-border">
          <option value="">-- {t('users.topup.method.placeholder')} --</option>
          {methods.map(m=> <option key={m.id} value={m.id}>{m.name||m.id}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1"><label className="text-xs">{t('billing.pay.invoiceId')}</label>
        <select value={invoiceId} onChange={e=>setInvoiceId(e.target.value)} className="px-2 py-1 rounded bg-bg-surface border border-border">
          <option value="">({t('users.topup.note.label')})</option>
          {invoices.map(inv=> <option key={inv.id} value={inv.id}>{inv.periodStart?.slice(0,10)} → {inv.periodEnd?.slice(0,10)}</option>)}
        </select>
      </div>
      <button disabled={loading || !methods.length} className="px-4 py-2 rounded bg-primary text-white text-sm disabled:opacity-50">{t('billing.pay.submit')}</button>
    </form>
    {res && <div className="text-green-500 text-sm">{t('billing.pay.success',{id:res.depositId})} <div className="text-xs opacity-70 mt-1">{t('billing.pay.notice.sent')}</div></div>}
    {err && <ErrorMsg code={err?.response?.data?.code} />}
  </div>;
}
function ErrorMsg({code}:{code?:string}){ const t=useT(); if(!code) return <div className="text-red-500 text-xs">{t('billing.pay.errors.unexpected')}</div>; const map:Record<string,string>={ INVALID_AMOUNT:t('billing.pay.errors.invalidAmount'), METHOD_REQUIRED:t('billing.pay.errors.methodRequired'), INVOICE_NOT_OPEN:t('billing.pay.errors.invoiceNotOpen'), TENANT_SUSPENDED:t('billing.pay.errors.tenantSuspended') }; return <div className="text-red-500 text-xs" dir="ltr">{map[code]||code}</div>; }
