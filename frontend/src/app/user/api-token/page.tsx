'use client';
import { useEffect, useState } from 'react';

interface TokenState { enabled: boolean; revoked: boolean; hasToken: boolean; lastUsedAt: string | null; }

export default function UserApiTokenPage(){
  const [info,setInfo]=useState<TokenState|null>(null);
  const [token,setToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState<string|null>(null);

  async function load(){
    setLoading(true); setMsg(null);
    try{
      const res=await fetch('/api/user/client-api/token',{cache:'no-store'});
      setInfo(await res.json());
    }catch{ setMsg('تعذر تحميل الحالة'); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  async function call(path: string){
    setLoading(true); setMsg(null);
    try{
      const res=await fetch('/api/user/client-api/'+path,{ method:'POST'});
      const j=await res.json();
      if(j.token) setToken(j.token); else setToken(null);
      await load();
      setMsg('تم بنجاح');
    }catch{ setMsg('فشل التنفيذ'); }
    finally{ setLoading(false); }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-semibold">واجهة API</h1>
      <p className="text-sm text-gray-600">يمكنك توليد توكن للوصول إلى واجهة العميل. احتفظ به بسرية. يمكنك تدويره أو إبطاله في أي وقت.</p>
      {loading && <div className="text-sm">جارٍ...</div>}
      {msg && <div className="text-sm text-green-600">{msg}</div>}
      {info && (
        <div className="space-y-4">
          <div className="p-4 border rounded bg-white">
            <div className="text-sm">الحالة: {info.revoked ? 'مُبطَل' : info.hasToken ? 'فعال' : 'لا يوجد توكن'}</div>
            <div className="text-sm">آخر استخدام: {info.lastUsedAt ? new Date(info.lastUsedAt).toLocaleString() : '—'}</div>
          </div>
          {token && <div className="p-3 bg-amber-50 border rounded text-sm break-all">
            <div className="font-medium mb-1">التوكن (انسخه الآن، لن يظهر لاحقًا):</div>
            <code>{token}</code>
          </div>}
          <div className="flex flex-wrap gap-3 text-sm">
            <button disabled={loading} onClick={()=>call('generate')} className="btn btn-sm">توليد</button>
            <button disabled={loading||!info.hasToken||info.revoked} onClick={()=>call('rotate')} className="btn btn-sm">تدوير</button>
            <button disabled={loading||!info.hasToken||info.revoked} onClick={()=>call('revoke')} className="btn btn-sm">إبطال</button>
          </div>
        </div>
      )}
    </div>
  );
}
