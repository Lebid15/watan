"use client";
import { useEffect, useState } from 'react';
import { formatMoney3 } from '@/utils/format';
import { useT } from '@/i18n';
import { getTenantBillingOverview } from '@/utils/billingApi';
import SuspendedBanner from '@/components/billing/SuspendedBanner';

export default function BillingOverviewPage() {
  const t = useT();
  const [data,setData]=useState<any>(null);
  const [err,setErr]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const token = localStorage.getItem('token');
    if(!token){setLoading(false);return;}
    getTenantBillingOverview(token).then(r=>{setData(r.data);}).catch(e=>{setErr(e);}).finally(()=>setLoading(false));
  },[]);
  if(loading) return <div>{t('billing.loading')}</div>;
  const suspended = err?.response?.status===403 && err?.response?.data?.code==='TENANT_SUSPENDED';
  return <div className="p-4 space-y-4">
    {suspended && <SuspendedBanner />}
    {!data && !suspended && <div>{t('common.error')}</div>}
    {data && <div className="grid gap-3 md:grid-cols-3 text-sm">
      <Stat label={t('billing.status.'+data.status?.toLowerCase())} value={data.status}/>
      <Stat label={t('billing.currentPeriod')} value={`${data.currentPeriodStart?.slice(0,10)} → ${data.currentPeriodEnd?.slice(0,10)}`}/>
      <Stat label={t('billing.nextDueAt')} value={data.nextDueAt?.slice(0,10) || '-'} />
      <Stat label={t('billing.openInvoices')} value={data.openInvoiceCount} />
      {data.daysOverdue!=null && <Stat label={t('billing.daysOverdue')} value={data.daysOverdue} />}
      {data.daysUntilDue!=null && <Stat label={t('billing.daysUntilDue')} value={data.daysUntilDue} />}
      {data.lastInvoice && <Stat label={t('billing.lastInvoice')} value={formatMoney3(data.lastInvoice.amountUsd)} />}
    </div>}
  </div>;
}
function Stat({label,value}:{label:string;value:any}){return <div className="bg-bg-surface-alt p-3 rounded border border-border"><div className="text-xs opacity-70 mb-1">{label}</div><div className="font-mono" dir="ltr">{value??'-'}</div></div>;}
