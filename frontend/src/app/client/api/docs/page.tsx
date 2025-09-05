'use client';
import { useState } from 'react';

function CopyBtn({text}:{text:string}){const [copied,setCopied]=useState(false);return <button onClick={()=>{navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1200);});}} className="btn btn-ghost btn-xs ml-2">{copied?'✓':'نسخ'}</button>;}

export default function ClientApiDocs(){
  const base = typeof window!=='undefined'? window.location.origin: 'https://api.example.com';
  const openapi = base + '/client/api/openapi.json';
  const swagger = base + '/api/docs';
  const curlBase = base;
  const examples = {
    profile: `curl -H "api-token: YOUR_API_TOKEN" ${curlBase}/client/api/profile`,
    products: `curl -H "api-token: YOUR_API_TOKEN" "${curlBase}/client/api/products?products_id=ID1,ID2&base=1"`,
    newOrder: `curl -X POST -H "api-token: YOUR_API_TOKEN" "${curlBase}/client/api/newOrder/PRODUCT_ID/params?qty=1&order_uuid=UUIDv4"`,
    checkIds: `curl -H "api-token: YOUR_API_TOKEN" "${curlBase}/client/api/check?orders=ORDER_ID1,ORDER_ID2"`,
    checkUuids: `curl -H "api-token: YOUR_API_TOKEN" "${curlBase}/client/api/check?orders=UUIDv4_VALUE&uuid=1"`,
    fetchProfile: `fetch('${curlBase}/client/api/profile',{headers:{'api-token':'YOUR_API_TOKEN'}}).then(r=>r.json())`,
  };
  return <div className="max-w-5xl mx-auto p-6 space-y-8" dir="rtl">
    <h1 className="text-2xl font-bold flex items-center gap-2">🔥 توثيق Client API</h1>
    <section className="space-y-4">
      <div className="bg-white/5 border rounded p-4 text-sm">
        <div className="font-semibold mb-2">Base URL:</div>
        <code className="bg-black/60 px-2 py-1 rounded inline-block break-all">{base}/client/api/</code>
      </div>
      <div className="bg-red-50/40 border border-red-200 rounded p-4 text-sm text-gray-800 dark:text-gray-100">
        <div className="font-semibold mb-2">الهيدر المطلوب</div>
        <code className="block bg-[#151521] text-gray-100 px-3 py-2 rounded">api-token: YOUR_API_TOKEN</code>
      </div>
    </section>

    <section className="space-y-6">
      <h2 className="text-lg font-semibold">المسارات والأمثلة</h2>
      <div className="space-y-6">
        <Endpoint title="Profile" method="GET" path="/client/api/profile" desc="يعيد المعلومات الأساسية للرصيد والملف" example={examples.profile} response={`{\n  "balance": 789.65,\n  "email": "user@email.com"\n}`} />
        <Endpoint title="Products" method="GET" path="/client/api/products" desc="قائمة المنتجات (مع إمكانية تصفية products_id=ID1,ID2 أو base=1)" example={examples.products} response={`[{"id":"ID1","name":"Product 1"}]`} />
        <Endpoint title="Create Order" method="POST" path="/client/api/newOrder/{productId}/params?qty=1&order_uuid=UUIDv4" desc="إنشاء طلب جديد – استخدم order_uuid لضمان idempotency" example={examples.newOrder} response={`{"id":"ORDER_ID","productId":"PRODUCT_ID","qty":1}`} />
        <Endpoint title="Check Orders" method="GET" path="/client/api/check?orders=..." desc="التحقق بحجز معرف الطلب أو بالـ UUID عند إضافة uuid=1" example={examples.checkIds} response={`[{"id":"ORDER_ID","status":"pending"}]`} />
        <Endpoint title="Check by order_uuid" method="GET" path="/client/api/check?orders=UUIDv4&uuid=1" desc="التحقق باستخدام order_uuid" example={examples.checkUuids} response={`[{"id":"ORDER_ID","status":"pending"}]`} />
      </div>
    </section>

    <section className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold">ملاحظات الكمية (qty)</h2>
      <ul className="list-disc pr-5 space-y-1 text-xs leading-relaxed">
        <li>قد تكون الكمية ثابتة (fixed) أو نطاق (range) أو قائمة قيم (list) أو غير مطلوبة (null).</li>
        <li>تحقق من خصائص المنتج للحصول على القيود (min/max أو القائمة المسموحة).</li>
        <li>الـ order_uuid (نوع UUIDv4) يمنع إدخال طلب مكرر إذا أعدت نفس الاستدعاء.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-lg font-semibold">أكواد الأخطاء</h2>
      <table className="text-xs w-full border">
        <thead><tr className="bg-black/30"><th className="p-1 text-right">الكود</th><th className="p-1 text-right">الوصف المختصر</th></tr></thead>
        <tbody>
          {[[120,'مطلوب التوكن'],[121,'خطأ توكن'],[122,'غير مسموح'],[123,'IP مرفوض'],[130,'صيانة'],[429,'تجاوز الحد'],[100,'خطأ عام'],[105,'الكمية غير متاحة'],[106,'الكمية مرفوضة'],[107,'?'],[108,'?'],[109,'المنتج غير موجود'],[110,'غير متاح'],[111,'?'],[112,'أقل من المسموح'],[113,'أكبر من المسموح'],[114,'باراميتر مفقود/خاطئ'],[500,'مجهول']].map(r=> <tr key={r[0]} className="border-t"><td className="p-1 font-mono">{r[0]}</td><td className="p-1">{r[1]}</td></tr>)}
        </tbody>
      </table>
    </section>

    <section className="space-y-2 text-xs">
      <h2 className="text-sm font-semibold">روابط تقنية</h2>
      <div className="flex items-center flex-wrap gap-2"><code className="px-2 py-1 bg-black/50 rounded break-all">{openapi}</code><CopyBtn text={openapi}/></div>
      <div className="flex items-center flex-wrap gap-2"><code className="px-2 py-1 bg-black/50 rounded break-all">{swagger}</code><CopyBtn text={swagger}/></div>
    </section>
  </div>;
}

function Endpoint({title,method,path,desc,example,response}:{title:string;method:string;path:string;desc:string;example:string;response:string;}){
  return <div className="border rounded p-4 space-y-3 bg-white/5">
    <div className="flex items-center gap-2 text-sm font-semibold"><span>{title}</span><span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded">{method}</span><code className="text-[11px] bg-black/50 px-1 rounded">{path}</code></div>
    <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
    <div>
      <div className="text-[11px] mb-1 flex items-center">مثال طلب <CopyBtn text={example}/></div>
      <pre className="bg-[#151521] text-[11px] text-gray-200 p-3 rounded whitespace-pre-wrap break-all">{example}</pre>
    </div>
    <div>
      <div className="text-[11px] mb-1">Response Example</div>
      <pre className="bg-[#151521] text-[11px] text-gray-200 p-3 rounded whitespace-pre-wrap break-all">{response}</pre>
    </div>
  </div>;
}
