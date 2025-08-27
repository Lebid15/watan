"use client";
import React,{useEffect,useState} from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter, usePathname } from 'next/navigation';
import MainHeader from '@/components/layout/MainHeader';

export default function OwnerLayout({children}:{children:React.ReactNode}){
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [ready,setReady]=useState(false);
  useEffect(()=>{refreshUser();},[]);
  useEffect(()=>{ if(loading) return; if(!user){ router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
    const role=(user.role||'').toLowerCase(); if(role!=='instance_owner'){ if(role==='tenant_owner') router.replace('/tenant'); else if(role==='distributor') router.replace('/distributor'); else router.replace('/403'); return; }
    setReady(true);
  },[user,loading,router,pathname]);
  if(!ready) return null;
  return <div className="pt-20"><MainHeader /><div className="max-w-7xl mx-auto p-4 space-y-6">{children}</div></div>;
}
