# Store Preview (Option 3A: iframe + postMessage)

حل نهائي لعرض المتجر كاملاً داخل لوحة الإدارة بدون سكرول أفقي، مع الحفاظ على pinch-to-zoom الطبيعي داخل المتجر (المستخدم يمكن يكبّر/يصغّر داخل iframe إذا أراد، بينما نحن نطبّق scale خارجي لملاءمة الإطار).

## 1. متطلبات في صفحات المتجر (Subdomain)
أضِف/ثبّت وسم الـ viewport في `<head>`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
```

أضف السكربت التالي (يمكن inline أو ملف مستقل `store-dimensions.js`). لا تُعدّل كود المتجر هنا إن كان خارج نطاقك الآن؛ فقط جهّز الملف لتضمينه لاحقاً:
```html
<script>
(function sendSize(){
  function post() {
    try {
      var w = document.documentElement.scrollWidth;
      var h = document.documentElement.scrollHeight;
      parent.postMessage({ type: 'storeDimensions', scrollWidth: w, scrollHeight: h }, '*');
    } catch(_) {}
  }
  window.addEventListener('load', post);
  window.addEventListener('resize', function(){
    // micro debounce
    clearTimeout(window.__storeSizeT);
    window.__storeSizeT = setTimeout(post, 60);
  });
  // MutationObserver (اختياري لو المحتوى ديناميكي بشدة)
  var mo = new MutationObserver(function(){
    clearTimeout(window.__storeSizeT);
    window.__storeSizeT = setTimeout(post, 120);
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: false });
  // إرسال مبدئي متكرر لبعض الثواني لضمان الالتقاط المبكر
  var attempts = 0;
  var iv = setInterval(function(){
    post();
    attempts++;
    if (attempts > 10) clearInterval(iv);
  }, 300);
})();
</script>
```
> لاحقاً استبدل `'*'` بقائمة origins للأب إن أردت تشديد الأمان (مثال: `parent.postMessage(..., 'https://admin.example.com')`).

## 2. في لوحة الإدارة (الأب)
استخدم المكوّن `StorePreviewFrame` الذي أُضيف في `frontend/src/components/StorePreviewFrame.tsx`.

مثال استعمال:
```tsx
import StorePreviewFrame from '@/components/StorePreviewFrame';

export default function TenantStorePreview() {
  const allowed = [
    'https://store1.example.com',
    'https://store2.example.com',
  ];
  return (
    <div className="h-screen p-2">
      <StorePreviewFrame
        src="https://store1.example.com" 
        allowedOrigins={allowed}
        className="w-full h-full"
        fallbackTimeoutMs={2000}
      />
    </div>
  );
}
```

## 3. آلية العمل
1. المتجر يرسل أبعاده الفعلية (scrollWidth/scrollHeight).
2. الأب يحسب scale = أصغر نسبة لملاءمة العرض والارتفاع.
3. يطبّق `transform: scale()` على غلاف iframe ويضبط أبعاد الغلاف للأبعاد الطبيعية.
4. إذا لم تصل رسالة خلال 2s يعمل fallback (ملاءمة العرض فقط) دون افتراض الارتفاع.
5. يعاد الحساب عند:
   - وصول رسالة جديدة بأبعاد مختلفة.
   - Resize للكونتينر (ResizeObserver).
   - Orientation change.

## 4. الأمان
- المكوّن يتحقق من `origin` للرسالة (`allowedOrigins`).
- تجاهل أي رسالة بلا `type=storeDimensions` أو قيم غير رقمية موجبة.
- يفضّل في المتجر استبدال `'*'` عند الاستقرار.

## 5. معايير القبول (Validation Checklist)
- لا يوجد سكرول أفقي داخل صفحة المعاينة (تحقق عبر DevTools).
- عند تدوير الهاتف (عمودي/أفقي) يتغير scale في أقل من ~150ms.
- يمكن للمستخدم داخل المتجر عمل pinch طبيعي (الـ iframe نفسه يحتفظ بسلوك المتصفح الافتراضي).
- لو أخفقت رسائل postMessage (حُجبت مؤقتاً) يظهر المحتوى ملبياً العرض (fallback-width-fit badge صغيرة).

## 6. Fallback مؤقت (Screenshot) إن تعذّر إضافة السكربت الآن
إن لم تستطع تعديل المتجر حالياً:
1. التقط لقطة شاشة (رأس الصفحة + أقسام رئيسية) عبر أداة خارجية.
2. اعرض الصورة داخل نفس مساحة `StorePreviewFrame` مع `object-fit: contain; width:100%; height:100%; background:#fff`.
3. أضف إشعار: "عرض ثابت (Screenshot) – عد لاحقاً للمعاينة التفاعلية".
4. حالما يصبح تعديل المتجر ممكناً أضف سكربت الرسالة وأعد تفعيل iframe.

## 7. تحسنيات مستقبلية (اختيارية)
- قياس زمن آخر رسالة وعرض Warning إن تأخر التحديث >5s.
- ضغط الرسائل (عدم الإرسال إلا عند تغير > 8px).
- دعم scroll position snapshot (لو احتجت مزامنة).</n- تصدير hook يعيد scale الحالي لعرضه في واجهة التحكم.

## 8. استكشاف أخطاء
| المشكلة | السبب المحتمل | الحل |
|---------|----------------|------|
| بقاء حالة waiting-size | رسائل محجوبة أو origin غير مطابق | أضف origin الصحيح للائحة allowedOrigins أو افحص console | 
| flicker في الارتفاع | تغييرات DOM سريعة | زد Debounce إلى 150-180ms | 
| عدم عمل pinch | إطار حاوي يغطي الإطار | تأكد أن `pointer-events` غير معطلة على iframe | 
| أبعاد خاطئة (صغيرة) | عنصر root لديه overflow مخفي | أزل overflow-x المخفي من html/body في المتجر | 

---
جاهز للدمج. أضف origins الفعلية ثم اختبر على جهاز محمول حقيقي.
