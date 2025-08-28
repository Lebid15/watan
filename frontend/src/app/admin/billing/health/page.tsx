"use client";
import { useEffect, useState } from 'react';
import { adminHealth } from '@/utils/billingApi';
import { useT } from '@/i18n';

export default function AdminBillingHealth(){
  const t=useT();
  const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{const token=localStorage.getItem('token'); if(!token){setLoading(false);return;} adminHealth(token).then(r=>setData(r.data)).finally(()=>setLoading(false));},[]);
  if(loading) return <div>{t('billing.loading')}</div>;
  if(!data) return <div>ERR</div>;
  if(data.status==='disabled') return <div className="text-yellow-500">{t('billing.feature.disabled')}</div>;
  return <div className="p-4 grid gap-3 md:grid-cols-3 text-xs">
    <Card label={t('billing.health.lastIssueAt')} v={data.lastIssueAt||'-'} />
    <Card label={t('billing.health.lastEnforceAt')} v={data.lastEnforceAt||'-'} />
    <Card label={t('billing.health.lastRemindAt')} v={data.lastRemindAt||'-'} />
    <Card label={t('billing.openInvoices')} v={data.openInvoices} />
    <Card label={t('billing.health.suspendedTenants')} v={data.suspendedTenants} />
  </div>;
}
function Card({label,v}:{label:string;v:any}){return <div className="bg-bg-surface-alt p-3 rounded border border-border"><div className="text-[11px] opacity-70 mb-1">{label}</div><div className="font-mono" dir="ltr">{v}</div></div>;}
