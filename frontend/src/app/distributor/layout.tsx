"use client";
import React, { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DistributorLayout({ children }:{children:React.ReactNode}){
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [ready,setReady]=useState(false);
  useEffect(()=>{refreshUser();},[]);
  useEffect(()=>{
    if(loading) return; if(!user){ router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
  const raw = (user.role||'').toLowerCase();
  const role = ['instance_owner','owner','admin'].includes(raw)?'tenant_owner':raw;
  if(role !== 'distributor'){ if(role==='tenant_owner') router.replace('/tenant'); else router.replace('/403'); return; }
    setReady(true);
  },[user,loading,router,pathname]);
  if(!ready) return null;
  return <div className="max-w-7xl mx-auto p-4 space-y-6">{children}</div>;
}
