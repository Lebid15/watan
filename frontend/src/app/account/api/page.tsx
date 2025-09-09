'use client';
import { useEffect, useState } from 'react';
import api from '@/utils/api';

interface SettingsState {
  allowAll: boolean;
  allowIps: string[];
  enabled: boolean;
  revoked: boolean;
  lastUsedAt: string | null;
  rateLimitPerMin: number | null;
  webhook?: { enabled: boolean; url: string | null; hasSecret: boolean; sigVersion: string; lastRotatedAt: string | null };
}

export default function AccountApiPage(){
  const [settings,setSettings]=useState<SettingsState|null>(null);
  const [token,setToken]=useState<string|null>(null); // shows only after generate/rotate
  const [ipsText,setIpsText]=useState('');
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState<string|null>(null);
  const [allowAll,setAllowAll]=useState(true);
  const [rateLimit,setRateLimit]=useState<string>('');

  async function load(){
    try{
      const r = await api.get('/tenant/client-api/users/me/settings', { params: { _ts: Date.now() } });
      const j = r.data;
      setSettings(j);
      setAllowAll(j.allowAll);
      setIpsText((j.allowIps||[]).join('\n'));
      setRateLimit(j.rateLimitPerMin? String(j.rateLimitPerMin):'');
    }catch{ setMsg('فشل تحميل الإعدادات'); }
  }
  useEffect(()=>{ load(); },[]);

  async function action(kind: 'generate'|'rotate'|'revoke'){
    setLoading(true); setMsg(null); setToken(null);
    try{
      const r = await api.post('/tenant/client-api/users/me/'+kind);
      const j = r.data;
  if(j.token) { setToken(j.token); setMsg('تم الإنشاء – انسخ التوكن الآن'); }
  else { setMsg(kind==='revoke'?'تم الإبطال':'تم التنفيذ'); }
  await load();
    }catch{ setMsg('فشل العملية'); }
    finally{ setLoading(false); }
  }

  async function saveSettings(){
    setLoading(true); setMsg(null);
    try{
      const ips=ipsText.split(/\n+/).map(s=>s.trim()).filter(Boolean).slice(0,200);
      const body:any={ allowAll, allowIps: ips, rateLimitPerMin: rateLimit? Number(rateLimit): null };
      const r = await api.patch('/tenant/client-api/users/me/settings', body);
      if(r.status < 200 || r.status >= 300) throw 0;
      await load();
      setMsg('تم الحفظ');
    }catch{ setMsg('فشل الحفظ'); }
    finally{ setLoading(false); }
  }

  function copyToken(){ if(!token) return; navigator.clipboard.writeText(token).then(()=> setMsg('تم النسخ')).catch(()=>{}); }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const openapiUrl = baseUrl + '/client/api/openapi.json';
  const swaggerUrl = baseUrl + '/api/docs';
  return <div className="max-w-4xl mx-auto p-6 space-y-6" dir="rtl">
  <h1 className="text-2xl font-bold flex items-center gap-4">واجهة API <a href="/client/api/docs" target="_blank" className="btn btn-xs" rel="noreferrer">فتح التوثيق الكامل</a></h1>
  <p className="text-sm text-gray-500">يمكنك توليد توكن للوصول إلى Client API. احتفظ به بسرية؛ يمكن تدويره أو إبطاله في أي وقت. للتفاصيل والأمثلة الكاملة زر <a href="/client/api/docs" target="_blank" className="text-blue-600 underline" rel="noreferrer">/client/api/docs</a>.</p>

    {msg && <div className="text-sm text-green-600">{msg}</div>}

    {settings && <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold">التوكن</h2>
        <div className="text-xs">الحالة: {settings.revoked? 'مُبطَل': settings.enabled? 'فعال': 'غير مفعل'}</div>
        <div className="text-xs">آخر استخدام: {settings.lastUsedAt? new Date(settings.lastUsedAt).toLocaleString(): '—'}</div>
        {token && <div className="p-2 bg-amber-100 rounded text-xs break-all relative">
          <div className="mb-1 font-medium">التوكن الجديد (لن يظهر مرة أخرى):</div>
          <code className="block">{token}</code>
          <button onClick={copyToken} className="btn btn-xs absolute left-2 top-2">نسخ</button>
        </div>}
        <div className="flex flex-wrap gap-2 text-sm">
          <button disabled={loading} onClick={()=>action('generate')} className="btn btn-xs">Generate</button>
          <button disabled={loading||!settings.enabled||settings.revoked} onClick={()=>action('rotate')} className="btn btn-xs">Rotate</button>
            <button disabled={loading||!settings.enabled||settings.revoked} onClick={()=>action('revoke')} className="btn btn-xs">Revoke</button>
        </div>
        <div className="text-[11px] leading-relaxed text-gray-600 mt-2">
          أرسل الهيدر في كل طلب: <code className="bg-gray-200 px-1 rounded">api-token: YOUR_TOKEN</code><br/>
          استخدم <code>order_uuid</code> (UUIDv4) مع إنشاء الطلب لمنع التكرار.
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold">قائمة عناوين IP</h2>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={allowAll} onChange={e=>setAllowAll(e.target.checked)} />
          السماح لكل العناوين (غير مستحسن للإنتاج)
        </label>
        {!allowAll && <textarea value={ipsText} onChange={e=>setIpsText(e.target.value)} className="w-full h-32 text-xs p-2 border rounded" placeholder="أدخل IP في كل سطر"></textarea>}
        <div className="text-xs text-gray-500">اترك الحقل فارغًا للسماح لجميع العناوين أو ألغِ علامة الاختيار واكتب عناوين محددة.</div>
        <div className="space-y-2">
          <label className="block text-xs font-medium">الحد لكل دقيقة (Rate Limit)</label>
          <input value={rateLimit} onChange={e=>setRateLimit(e.target.value)} className="w-40 text-xs p-1 border rounded" placeholder="مثال 120" />
        </div>
        <button disabled={loading} onClick={saveSettings} className="btn btn-xs">حفظ الإعدادات</button>
      </div>
    </div>}

    <div className="p-4 border rounded bg-gray-50 space-y-2 text-xs leading-relaxed">
      <h2 className="font-semibold text-sm mb-1">المسارات الأساسية (مختصر)</h2>
  <code className="block whitespace-pre overflow-auto bg-black/60 p-2 rounded text-[10px] text-green-200">{`GET /client/api/profile
GET /client/api/products?products_id=...
GET /client/api/content/{categoryId}
POST /client/api/newOrder/{productId}/params?qty=1&order_uuid=UUID
GET /client/api/check?orders=[..]&uuid=1`}</code>
      <div className="font-medium pt-2">أكواد الأخطاء المختصرة:</div>
      <table className="text-[10px] w-full">
        <tbody>
          {[
            [120,'مطلوب التوكن'],[121,'خطأ توكن'],[122,'ممنوع الوصول'],[123,'IP غير مسموح'],[130,'صيانة'],[100,'عام'],[109,'المنتج غير موجود'],[110,'المنتج غير متاح'],[105,'الكمية غير متاحة'],[106,'الكمية مرفوضة'],[112,'الكمية أصغر من المسموح'],[113,'الكمية أكبر من المسموح'],[114,'باراميتر مفقود/خاطئ'],[429,'تجاوز الحد']
          ].map(r=> <tr key={r[0]}><td className="pr-2">{r[0]}</td><td>{r[1]}</td></tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
