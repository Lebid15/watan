# تثبيت Redis بأبسط طريقة ممكنة

## الطريقة الموصى بها: Memurai

### الخطوة 1: التحميل
افتح هذا الرابط في المتصفح:
```
https://www.memurai.com/get-memurai
```

أو مباشرة اضغط "Download" من هنا:
```
https://dist.memurai.com/v4.0.5/Memurai-Developer-v4.0.5.msi
```

### الخطوة 2: التثبيت
- شغّل الملف المحمّل (.msi)
- اضغط Next → Next → Install
- انتظر حتى ينتهي التثبيت
- خلاص! Redis الآن شغال على جهازك

### الخطوة 3: التحقق (اختياري)
افتح PowerShell واكتب:
```powershell
Get-Service Memurai
```

يجب أن تشوف:
```
Status: Running
```

---

## بعد التثبيت: تشغيل Celery

افتح PowerShell واكتب هذين السطرين فقط:

```powershell
cd f:\watan\djangoo
.\venv\Scripts\python.exe -m celery -A celery_app worker -l info --pool=solo
```

**خلاص!** النظام سيشتغل وسترى في الترمينال:
- كل طلب يتم فحصه
- حالة الطلب من المزود
- التحديثات التلقائية
- كل التفاصيل الدقيقة

---

## ملاحظة مهمة

**لا تحتاج تشغل أي شيء آخر!**
- Memurai سيشتغل تلقائياً مع Windows
- Django server مو محتاجه (خلّيه شغال عادي)
- فقط شغّل Celery worker وكل شيء جاهز

---

## إذا واجهت أي مشكلة

اكتب لي وأنا أساعدك! 😊
