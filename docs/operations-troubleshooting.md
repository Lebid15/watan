# Operations & Troubleshooting Guide

هدف الملف: خطوات ثابتة وسريعة لتشخيص أي تعطل، واختبار البيئة، وتجنب فقدان المفاتيح أو إعادة تكرار الأخطاء.

---
## 1. الفكرة العامة (الطبقات)
المتصفح → DNS/Cloudflare → nginx على الـ VPS → backend (NestJS) → Postgres / Redis → خدمات خارجية (Cloudinary).

أي انقطاع يحدث في إحدى هذه الطبقات.

---
## 2. تشخيص سريع (اختبار من جهازك)
1. DNS:
   nslookup syrz1.com
2. HTTPS مباشر:
   curl -I https://syrz1.com
   curl -I https://api.syrz1.com/api/health
3. لو OK (200) والموقع بطيء: نظّف cache المتصفح أو جرّب متصفح آخر.

---
## 3. داخل السيرفر (SSH)
1. حالة الحاويات:
   docker compose ps
2. سجلات آخر 40 سطر:
   docker compose logs --tail=40 backend
   docker compose logs --tail=40 nginx
3. فحص الـ health داخلياً:
   docker compose exec backend wget -q -O - http://127.0.0.1:3000/api/health
4. القيم في .env:
   grep CLOUDINARY_CLOUD_NAME .env
5. الموارد:
   free -m
   df -h
6. المنافذ:
   ss -tlnp | grep -E ':80 |:443 |:3000 '
7. آخر نشر / تعديل .env:
   ls -l --time-style=long-iso .env

سجّل النتائج (نجاح/فشل) لتعرف أين التوقف.

---
## 4. تفسير النتائج الشائعة
- curl خارجي فشل + wget داخلي فشل ⇒ backend متوقف أو لم يشتغل.
- curl خارجي فشل + wget داخلي ناجح ⇒ مشكلة nginx أو شبكة / TLS.
- curl ناجح والموقع بالمتصفح Timeout ⇒ DNS/Cache محلي أو مشكلة Frontend فقط.
- backend يعيد التشغيل بإستمرار ⇒ خطأ في الكود، أو ENV ناقص، أو OOM.
- أخطاء ENOTFOUND أو ECONNREFUSED في السجلات ⇒ خدمة داخلية غير متاحة.

---
## 5. البيئة والأسرار
- لا تعدل القيم الحساسة داخل الحاوية مباشرة. المصدر الوحيد: GitHub Secrets.
- أي نشر يعيد تكوين `.env` من Secrets. لذا لو فقدت قيمة تأكد أنها مضافة هناك.
- عند نهاية التطوير: دوّر مفاتيح Cloudinary + استبدل القيم في المستودع بـ PLACEHOLDER.

مثال PLACEHOLDER:
```
CLOUDINARY_API_KEY=__SET_IN_SECRETS__
CLOUDINARY_API_SECRET=__SET_IN_SECRETS__
CLOUDINARY_URL=__SET_IN_SECRETS__
```

---
## 6. docker-compose و الصحة
- أمر اختبار صحة backend: wget -q --spider http://127.0.0.1:3000/api/health
- قبل أي تعديل YAML:
  docker compose config > /dev/null  # يتحقق من صحة الصيغة

علامات تحذير:
- healthcheck يصبح بطيء (>2s) ⇒ ربما استعلامات ثقيلة أو ضغط ذاكرة.
- زيادة إعادة تشغيل الحاوية (RESTARTS في docker compose ps).

---
## 7. متى نعيد التشغيل؟
أعد التشغيل فقط إذا:
- أصلحت ملف تكوين (nginx.conf, docker-compose.yml).
- أضفت Secret جديد وتريد تحميله.
- التطبيق عالق ولا يرد و logs لا تتحرك.

وإلا: افحص أولاً ثم قرر.

---
## 8. سجل الحوادث (اقترح تعبئته يدوياً)
| التاريخ | المشكلة | السبب الجذري | الإجراء | الوقاية |
|---------|----------|--------------|---------|---------|
| 2025-08-26 | Upload فشل | مفاتيح Cloudinary ناقصة بالحاوية | إضافة Secrets + إعادة تشغيل | مراجعة workflow قبل النشر |
| 2025-08-26 | Health Unhealthy | wget حاول IPv6 (::1) وفشل | تعديل healthcheck لــ 127.0.0.1 | docker compose config للتحقق |
| 2025-08-26 | 521 Cloudflare | غياب بلوك HTTPS في nginx | إضافة server 443 | اختبار nginx محلياً |
| 2025-08-26 | Crash startup | استيراد cookie-parser خاطئ | تصحيح import | lint + build قبل النشر |
| 2025-08-26 | propagate خطأ | الاعتماد على tenantId للمطور | تجاهل propagate للمطور | اختبار وحدات للroles |
| 2025-08-26 | Timeout متصفح | backend يعيد الإقلاع بعد نشر | انتظار + فحص health داخلي | مراقبة زمنية (cron) |

(أكمل الجدول مع كل حادث جديد.)

---
## 9. تحسينات مستقبلية (اختيارية)
- Script فحص تلقائي (cron) ينفذ curl /health ويرسل تنبيه.
- إضافة مراقبة بسيطة (Netdata أو UptimeRobot).
- ربط logs إلى ملف خارجي (volume + rotation).

### 9.1 سكربت مراقبة (يُنشأ لاحقاً scripts/health-check.sh)
سطر cron نموذجي (كل دقيقتين):
```
*/2 * * * * /bin/bash /root/watan/scripts/health-check.sh >> /root/watan/health.log 2>&1
```
السكربت يجب أن يسجل فقط عند فشل أو تغير حالة لمنع تضخم الملف.
تأكد من إعطاء صلاحية تنفيذ:
```
chmod +x scripts/health-check.sh
```

---
## 10. ملخص ذهبي سريع
1. تأكد من DNS.
2. تأكد من health خارجي وداخلي.
3. راجع logs.
4. افحص الموارد.
5. لا تعدل الأسرار داخل الحاويات.
6. تحقق من YAML قبل النشر.
 7. تحقق من نزاهة المستأجرين (صفر مشاكل): داخل مجلد backend نفذ `npm run tenant:verify` ويجب أن يعود بدون أخطاء.

انتهى.

---
## ملحق A: تفعيل cron
تحقق:
```
systemctl status cron
```
تشغيل إن كان موقوفاً:
```
sudo systemctl enable --now cron
```

## ملحق B: اختبار صحة من Windows PowerShell
```
powershell -Command "try { $r=Invoke-WebRequest -Uri https://api.syrz1.com/api/health -UseBasicParsing -TimeoutSec 5; if($r.StatusCode -eq 200){'OK'} else {'BAD '+$r.StatusCode} } catch { 'ERR '+$_ }"
```

## ملحق C: مؤشرات أداء مبكرة
- زمن health يرتفع تدريجياً >800ms.
- حجم سجل backend ينمو بسرعة.
- زيادة قيمة RESTARTS في `docker compose ps`.
- أخطاء متقطعة (1/10) تشير لضغط موارد.
