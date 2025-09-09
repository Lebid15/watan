import { Controller, Get, Header } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Publicly served OpenAPI subset + human docs (no auth)
@Controller('/client/api')
export class ClientApiOpenapiPublicController {
  @Get('openapi.json')
  openapi() {
    try {
      const p = path.join(process.cwd(), 'openapi', 'openapi-client.json');
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { code: 500, message: 'OpenAPI not ready' };
    }
  }

  // Human-friendly HTML documentation page
  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  docs() {
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Client API Documentation</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
body{font-family:system-ui,Segoe UI,Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0 0 90px}
code,pre{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#1e293b;padding:2px 4px;border-radius:4px;color:#93c5fd}
a{color:#60a5fa}
h1,h2,h3,h4{margin:1.2em 0 .5em;font-weight:600;line-height:1.25}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13px}
th,td{border:1px solid #334155;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#1e293b;font-weight:600}
section{border:1px solid #1e293b;background:#11203a;padding:20px 22px 16px;margin:22px auto;max-width:1080px;border-radius:12px;box-shadow:0 2px 4px #0006}
header{background:#020617;padding:14px 18px 10px;border-bottom:1px solid #1e293b;position:sticky;top:0;z-index:30}
nav{display:flex;flex-wrap:wrap;gap:10px}
nav a.btn{background:#1e293b;border:1px solid #334155;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:13px}
nav a.btn:hover{background:#334155}
ul{margin:6px 0 14px;padding-right:22px}
pre{overflow:auto;direction:ltr;text-align:left;line-height:1.45;padding:10px 12px;margin:10px 0;border:1px solid #334155}
mark{background:#f59e0b33;color:#fbbf24;padding:0 4px;border-radius:4px}
footer{margin-top:40px;font-size:12px;text-align:center;color:#64748b}
.method{display:inline-block;min-width:54px;padding:2px 6px;border-radius:4px;font-weight:600;font-size:11px;text-align:center;color:#fff}
.GET{background:#0369a1}.POST{background:#15803d}
.tag{background:#334155;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px}
details summary{cursor:pointer;list-style:none}
details summary::-webkit-details-marker{display:none}
details{border:1px solid #334155;background:#0f1d33;padding:10px 14px;border-radius:8px;margin:12px 0}
.badge{background:#475569;padding:2px 6px;border-radius:6px;font-size:11px;margin-left:4px}
@media (max-width:880px){section{margin:18px 10px;padding:16px 14px} pre{font-size:11px}}
.table-small td,.table-small th{font-size:12px}
.nowrap{white-space:nowrap}
</style>
</head>
<body>
<header>
 <h1 style="margin:0;font-size:21px">Client API – وثائق تفصيلية</h1>
 <div style="margin:6px 0 10px;font-size:13px">كل المسارات تبدأ بالبادئة <code>/client/api/</code></div>
 <nav>
  <a class="btn" href="#base-url">Base URL</a>
  <a class="btn" href="#auth">المصادقة</a>
  <a class="btn" href="#profile">Profile</a>
  <a class="btn" href="#products">Products</a>
  <a class="btn" href="#content">Content</a>
  <a class="btn" href="#order">New Order</a>
  <a class="btn" href="#check">Check Orders</a>
  <a class="btn" href="#errors">Errors</a>
  <a class="btn" href="/client/api/openapi.json" target="_blank">openapi.json</a>
 </nav>
</header>

<section id="base-url">
 <h2>Base URL</h2>
 <p><strong>Base URL:</strong> <code>https://alsham.wtn4.com/</code></p>
 <p>أضف المسار المطلوب بعد <code>/client/api/</code>. مثال: <code>https://alsham.wtn4.com/client/api/profile</code></p>
</section>

<section id="auth">
 <h2>المصادقة (Authentication)</h2>
 <p>ضع ترويسة (Header) من النوع Bearer Token في كل طلب:</p>
 <pre>Authorization: Bearer YOUR_TOKEN</pre>
 <p>مثال سريع:</p>
 <pre>curl -H "Authorization: Bearer YOUR_TOKEN" https://alsham.wtn4.com/client/api/profile</pre>
 <p>استلم التوكن من النظام (يُولد للمستخدم العميل). أي طلب بدون التوكن سيعيد خطأ 401 أو 403.</p>
</section>

<section id="profile">
 <h2>Profile <span class="tag">GET /client/api/profile</span></h2>
 <p>Retrieves the user’s profile and balance. يجلب بيانات الحساب (اسم المستخدم / البريد / الرصيد / العملة).</p>
 <table class="table-small"><tr><th>Method</th><th>Endpoint</th><th>وصف</th></tr>
 <tr><td><span class="method GET">GET</span></td><td><code>/client/api/profile</code></td><td>الملف الشخصي والرصيد</td></tr></table>
 <details open><summary>مثال استجابة</summary>
 <pre>{
  "username": "demo_user",
  "email": "demo@example.com",
  "balance": "8788.683",
  "currency": "USD"
}</pre>
 </details>
</section>

<section id="products">
 <h2>Products <span class="tag">GET /client/api/products</span></h2>
 <p>جلب قائمة المنتجات أو منتجات محددة أو بيانات أساسية فقط.</p>
 <table class="table-small">
  <tr><th>الاستخدام</th><th>الوصف</th></tr>
  <tr><td><code>GET /client/api/products</code></td><td>جميع المنتجات</td></tr>
  <tr><td><code>GET /client/api/products?products_id=id1,id2</code></td><td>منتجات محددة حسب معرفات متعددة</td></tr>
  <tr><td><code>GET /client/api/products?product_id=id</code></td><td>منتج واحد حسب المعرف</td></tr>
  <tr><td><code>GET /client/api/products?base=1</code></td><td>البيانات الأساسية (معرف + الاسم) – أسرع</td></tr>
 </table>
 <h3>qty_values توضيح</h3>
 <ul>
  <li><code>null</code> → الكمية في الطلب يجب أن تكون <code>1</code> فقط.</li>
  <li><code>["110","150","210"]</code> → يسمح فقط بالقيم المذكورة.</li>
  <li><code>{"min":"500","max":"500000"}</code> → مدى يجب أن تكون الكمية ضمنه.</li>
 </ul>
 <details open><summary>مثال استجابة كاملة</summary>
 <pre>[
  {
    "id": 365,
    "name": "UC 60",
    "price": 0.104,
    "params": ["ادخل الايدي الاعب"],
    "category_name": "UC 60",
    "available": true,
    "qty_values": {"min": 1, "max": "15000"},
    "product_type": "amount",
    "parent_id": 0,
    "base_price": 0.10,
    "category_img": ""
  },
  {
    "id": 18,
    "name": "UC 60",
    "price": 1.094,
    "params": ["ادخل الايدي الاعب"],
    "category_name": "PUBG Global ID UC",
    "available": true,
    "qty_values": null,
    "product_type": "package",
    "parent_id": 7,
    "base_price": 0.877,
    "category_img": "images/category/1710948113.webp"
  }
]</pre>
 </details>
</section>

<section id="content">
 <h2>Content <span class="tag">GET /client/api/content/:categoryId</span></h2>
 <p>جلب تصنيفات ومنتجات ضمن فئة معينة.</p>
 <ul>
  <li><code>/client/api/content/0</code> → محتوى الصفحة الرئيسية (جذر الفئات).</li>
  <li><code>/client/api/content/{categoryId}</code> → محتوى فئة محددة (منتجات + فئات فرعية).</li>
 </ul>
 <details open><summary>مثال استجابة</summary>
 <pre>{
  "categories": [
    {"id": 7, "name": "PUBG Global ID UC", "img": "images/category/1710948113.webp"}
  ],
  "products": [
    {"id": 365, "name": "UC 60", "price": 0.104, "available": true},
    {"id": 18,  "name": "UC 60", "price": 1.094, "available": true}
  ]
}</pre>
 </details>
</section>

<section id="order">
 <h2>New Order <span class="tag">POST /client/api/newOrder/{packageId}/params</span></h2>
 <p>إنشاء طلب جديد لمنتج. <strong>هام:</strong> استخدم <code>order_uuid</code> (UUIDv4) فريد لكل محاولة جديدة. إذا أرسلت نفس <code>order_uuid</code> مرة أخرى سيُعاد نفس الطلب السابق بدون إنشاء مزدوج (Idempotency).</p>
 <h3>الأهمية (Idempotent Requests)</h3>
 <p>منع التكرار يحمي رصيد العميل من الخصم المزدوج. أعد نفس الطلب خلال انقطاع الشبكة بنفس <code>order_uuid</code> لتحصل على نفس البيانات.</p>
 <h3>البارامترات (Query Parameters)</h3>
 <table class="table-small">
  <tr><th>اسم</th><th>الوصف</th><th>مطلوب</th></tr>
  <tr><td class="nowrap">{packageId}</td><td>معرف الباقة (كان productId سابقاً)</td><td>نعم (في المسار)</td></tr>
  <tr><td>qty</td><td>الكمية (حسب <code>qty_values</code> للمنتج)</td><td>نعم غالباً</td></tr>
  <tr><td>order_uuid</td><td>معرف UUIDv4 فريد لمنع التكرار</td><td>نعم</td></tr>
  <tr><td>playerId / user_identifier / ...</td><td>حقول تعريف اللاعب/المستخدم (قد تختلف حسب المنتج)</td><td>حسب نوع المنتج</td></tr>
  <tr><td>أي مفاتيح أخرى</td><td>تمرير مفاتيح إضافية مطلوبة لذلك المنتج</td><td>اختياري</td></tr>
 </table>
 <h3>مثال cURL</h3>
 <pre>curl -X POST \
 -H "Authorization: Bearer YOUR_TOKEN" \
 "https://alsham.wtn4.com/client/api/newOrder/364/params?qty=1&playerId=test&order_uuid=ecbdd545-e616-4aee-8770-7eefa977bcd"</pre>
 <details open><summary>مثال استجابة</summary>
 <pre>{
  "id": "uuid",
  "order_uuid": "ecbdd545-e616-4aee-8770-7eefa977bcd",
  "origin": "client_api",
  "status": "wait",
  "quantity": 1,
  "price_usd": 0.877,
  "unit_price_usd": 0.877,
  "created_at": "2025-09-07T10:00:00.000Z",
  "reused": false
}</pre>
 </details>
 <h3>قِيَم الحالة المحتملة</h3>
 <ul><li><code>accept</code> → تم التنفيذ / مقبول</li><li><code>wait</code> → قيد المعالجة</li><li><code>reject</code> → مرفوض</li></ul>
 <p>الحقل <code>reused</code> يصبح <code>true</code> عند استعمال نفس <code>order_uuid</code> لطلب سبق إنشاؤه (لا خصم إضافي).</p>
</section>

<section id="check">
 <h2>Check Orders <span class="tag">GET /client/api/check</span></h2>
 <p>التحقق من حالة طلب واحد أو عدة طلبات.</p>
 <table class="table-small">
  <tr><th>الاستخدام</th><th>الوصف</th></tr>
  <tr><td><code>/client/api/check?orders=[ID_a37aaa06,ID2]</code></td><td>حسب معرفات الطلب</td></tr>
  <tr><td><code>/client/api/check?orders=[uuidValue]&uuid=1</code></td><td>حسب <code>order_uuid</code> بدلاً من معرف الطلب</td></tr>
 </table>
 <details open><summary>مثال استجابة</summary>
 <pre>{
  "status": "OK",
  "data": [
    {
      "order_id": "ID_9fffb0d849a45215",
      "quantity": 1,
      "data": { "playerId": "test" },
      "created_at": "2025-04-10 13:55:48",
      "product_name": "A-60UC-stock",
      "price": "1.2604800000000000",
      "status": "accept",
      "replay_api": ["erg3eg"]
    }
  ]
}</pre>
 </details>
 <h3>قِيَم الحالة</h3>
 <ul><li><code>accept</code></li><li><code>wait</code></li><li><code>reject</code></li></ul>
</section>

<section id="errors">
 <h2>Errors / الأكواد</h2>
 <h3>Public Error Codes</h3>
 <table class="table-small">
  <tr><th>Code</th><th>الوصف</th></tr>
  <tr><td>120</td><td>Api Token is required!</td></tr>
  <tr><td>121</td><td>Token error</td></tr>
  <tr><td>122</td><td>Not allowed to use API</td></tr>
  <tr><td>123</td><td>IP not allowed</td></tr>
  <tr><td>130</td><td>The site is under maintenance</td></tr>
 </table>
 <h3>Order Error Codes</h3>
 <table class="table-small">
  <tr><th>Code</th><th>الوصف</th></tr>
  <tr><td>100</td><td>Insufficient balance</td></tr>
  <tr><td>105</td><td>Quantity not available</td></tr>
  <tr><td>106</td><td>Quantity not allowed</td></tr>
  <tr><td>107</td><td>Player ID blocked</td></tr>
  <tr><td>108</td><td>2FA required</td></tr>
  <tr><td>109</td><td>Product deleted or not found</td></tr>
  <tr><td>110</td><td>Product not available now</td></tr>
  <tr><td>111</td><td>Try again after 1 minute</td></tr>
  <tr><td>112</td><td>Quantity is too small</td></tr>
  <tr><td>113</td><td>Quantity is too large</td></tr>
  <tr><td>114</td><td>Unknown error</td></tr>
  <tr><td>500</td><td>Unknown error (server)</td></tr>
 </table>
 <p>قد تختلف الأكواد الداخلية الخاصة بالتطبيق؛ راجع الاستجابة الكاملة لأي تفاصيل إضافية.</p>
</section>

<section id="notes">
 <h2>ملاحظات عامة</h2>
 <ul>
  <li>كل الأمثلة المعروضة توضيحية وقد تختلف القيم في بيئتك الفعلية.</li>
  <li>استخدم <code>order_uuid</code> ثابت أثناء إعادة المحاولة لنفس العملية فقط.</li>
  <li>تحقق من <a href="/client/api/openapi.json" target="_blank">openapi.json</a> للمخطط الآلي.</li>
 </ul>
</section>

<footer>آخر تحديث ${new Date().toISOString()} • © 2025 Client API Docs.</footer>
</body>
</html>`;
    return html;
  }
}
