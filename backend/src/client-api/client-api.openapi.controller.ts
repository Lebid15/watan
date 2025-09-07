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
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>Client API Docs</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:system-ui,Segoe UI,Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0 0 80px}code,pre{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#1e293b;padding:2px 4px;border-radius:4px;color:#93c5fd}a{color:#60a5fa}h1,h2,h3{margin:1.2em 0 .4em;font-weight:600;line-height:1.25}table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}th,td{border:1px solid #334155;padding:6px 8px;text-align:right;vertical-align:top}th{background:#1e293b;font-weight:600}section{border:1px solid #1e293b;background:#11203a;padding:18px 18px 12px;margin:20px auto;max-width:1000px;border-radius:10px;box-shadow:0 2px 4px #0006}header{background:#020617;padding:14px 18px;border-bottom:1px solid #1e293b;position:sticky;top:0;z-index:20}nav{display:flex;flex-wrap:wrap;gap:10px}nav a.btn{background:#1e293b;border:1px solid #334155;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:13px}nav a.btn:hover{background:#334155}ul{margin:6px 0 12px;padding-right:20px}pre{overflow:auto;direction:ltr;text-align:left;line-height:1.4}mark{background:#f59e0b33;color:#fbbf24;padding:0 4px;border-radius:4px}footer{margin-top:40px;font-size:12px;text-align:center;color:#64748b} .method{display:inline-block;min-width:54px;padding:2px 6px;border-radius:4px;font-weight:600;font-size:11px;text-align:center} .GET{background:#0369a1} .POST{background:#15803d} .NOTE{background:#7c2d12} .tag{background:#334155;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px} .grid{display:grid;gap:10px}@media (max-width:800px){section{margin:16px 10px;padding:14px}}details summary{cursor:pointer;list-style:none}details summary::-webkit-details-marker{display:none}details{border:1px solid #334155;background:#0f1d33;padding:10px 14px;border-radius:8px;margin:10px 0}</style></head><body>
<header><h1 style="margin:0;font-size:20px">Client API – وثائق</h1><nav>
<a class="btn" href="#auth">المصادقة</a>
<a class="btn" href="#profile">الملف الشخصي</a>
<a class="btn" href="#products">المنتجات</a>
<a class="btn" href="#content">المحتوى</a>
<a class="btn" href="#orders">إنشاء طلب</a>
<a class="btn" href="#check">التحقق</a>
<a class="btn" href="/client/api/openapi.json" target="_blank">openapi.json</a>
</nav></header>
<section id="intro"><h2>مقدمة</h2><p>هذه الواجهة مخصصة لعملاء المنصة للوصول إلى البيانات وإنشاء الطلبات. كل الطلبات تُرسل إلى المسار <code>/client/api/...</code> بنفس نطاق الـ API. تأكد من تضمين ترويسة <code>Authorization: Bearer &lt;TOKEN&gt;</code>.</p>
<h3>الاستجابات العامة</h3><ul><li>نجاح: 200 / 201 حسب العملية</li><li>أخطاء التحقق 400</li><li>ممنوع 401/403 عند فشل المصادقة</li><li>لم يُعثر عليه 404</li><li>محدودية / معدل 429</li></ul></section>
<section id="auth"><h2>المصادقة</h2><p>تحصل على <code>TOKEN</code> (يتم توليده داخلياً للمستخدم العميل) وتستخدمه في كل طلب:</p><pre>Authorization: Bearer YOUR_TOKEN</pre></section>
<section id="profile"><h2>Profile <span class="tag">GET</span></h2><p>جلب معلومات المستخدم والرصيد.</p><table><tr><th>Method</th><th>Endpoint</th><th>وصف</th></tr><tr><td><span class="method GET">GET</span></td><td><code>/client/api/profile</code></td><td>بيانات الحساب</td></tr></table><details open><summary>مثال استجابة</summary><pre>{\n  \"username\": \"demo\",\n  \"email\": \"demo@example.com\",\n  \"balance\": 123.45,\n  \"currency\": \"USD\"\n}</pre></details></section>
<section id="products"><h2>Products <span class="tag">GET</span></h2><p>عرض قائمة المنتجات أو منتجات محددة.</p><table><tr><th>الطلب</th><th>الاستعلامات</th><th>الوصف</th></tr>
<tr><td><code>GET /client/api/products</code></td><td>base=1? (اختياري)</td><td>كل المنتجات (أو الأساسية فقط مع base=1)</td></tr>
<tr><td><code>GET /client/api/products?products_id=ID1,ID2</code></td><td>products_id قائمة مع فاصلة</td><td>تصفية حسب معرفات متعددة</td></tr>
<tr><td><code>GET /client/api/products?product_id=ID</code></td><td>product_id مفرد</td><td>منتج واحد</td></tr></table>
<details open><summary>مثال استجابة مبسطة</summary><pre>[\n  { \"id\": \"p123\", \"name\": \"Product A\", \"min\":1, \"max\":10, \"price\": 2.50 },\n  { \"id\": \"p124\", \"name\": \"Product B\", \"fixed\": true, \"qty\": 5, \"price\": 9.99 }\n]</pre></details></section>
<section id="content"><h2>Content <span class="tag">GET</span></h2><p>جلب محتوى تصنيفي (بطاقات/حزم). </p><table><tr><th>Method</th><th>Endpoint</th><th>وصف</th></tr><tr><td><span class="method GET">GET</span></td><td><code>/client/api/content/{categoryId}</code></td><td>محتوى الفئة</td></tr></table><details><summary>مثال استجابة</summary><pre>[\n  { \"id\":\"c1\", \"title\":\"Card Pack\", \"items\": 10 },\n  { \"id\":\"c2\", \"title\":\"Bundle\", \"items\": 3 }\n]</pre></details></section>
<section id="orders"><h2>إنشاء طلب جديد <span class="tag">POST</span></h2><p>إنشاء طلب شراء.</p><table><tr><th>Method</th><th>Endpoint</th><th>البارامترات</th><th>الوصف</th></tr><tr><td><span class="method POST">POST</span></td><td><code>/client/api/newOrder/{productId}/params</code></td><td>qty (افتراضي 1) • order_uuid (لمنع الازدواج) • user_identifier • extra_field + أي بارامترات إضافية مطلوبة</td><td>إنشاء الطلب</td></tr></table><details open><summary>مثال طلب curl</summary><pre>curl -X POST \\\n  -H \"Authorization: Bearer TOKEN\" \\\n  \"https://api.example.com/client/api/newOrder/p123/params?qty=2&user_identifier=abc\"</pre></details><details><summary>مثال استجابة</summary><pre>{\n  \"id\": \"ord_789\",\n  \"productId\": \"p123\",\n  \"qty\": 2,\n  \"status\": \"pending\",\n  \"reused\": false\n}</pre></details><details><summary>ملاحظات حول order_uuid</summary><p>أرسل قيمة UUID ثابتة لإعادة نفس الطلب وعدم تكراره عند إعادة المحاولة (idempotency).</p></details></section>
<section id="check"><h2>التحقق من حالة الطلبات <span class="tag">GET</span></h2><p>التحقق من عدة طلبات بالمعرف أو UUID.</p><table><tr><th>Method</th><th>Endpoint</th><th>الاستعلامات</th><th>الوصف</th></tr><tr><td><span class="method GET">GET</span></td><td><code>/client/api/check</code></td><td>orders=ID1,ID2,... • uuid=1 (يجعل القيم UUID بدل ID)</td><td>حالة مجموعة طلبات</td></tr></table><details open><summary>مثال استجابة</summary><pre>[\n  { \"id\": \"ord_789\", \"status\": \"pending\" },\n  { \"id\": \"ord_790\", \"status\": \"done\" }\n]</pre></details></section>
<section id="errors"><h2>الأخطاء الشائعة</h2><table><tr><th>الكود</th><th>الحالة</th><th>الوصف</th></tr><tr><td><code>RATE_LIMIT</code></td><td>429</td><td>عدد طلبات مرتفع</td></tr><tr><td><code>NOT_FOUND</code></td><td>404</td><td>مورد غير موجود</td></tr><tr><td><code>INVALID_PARAMS</code></td><td>400</td><td>بارامترات غير صالحة</td></tr><tr><td><code>UNAUTHORIZED</code></td><td>401</td><td>توكن مفقود أو غير صالح</td></tr></table></section>
<footer>آخر تحديث ${new Date().toISOString()} • الوثائق مبسطة – راجع openapi.json للمخطط الكامل.</footer>
</body></html>`;
    return html;
  }
}
