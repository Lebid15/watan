# 🚀 تشغيل Celery لفحص الطلبات - دليل سريع

## ❌ المشكلة الحالية
```
⏰ Step 15: Scheduling status check...
   ⚠️ Failed to schedule status check: [WinError 10061] No connection could be made because the target machine actively refused it
```

**السبب**: Celery Worker غير متصل لأن Redis غير مشغّل.

## ✅ الحل السريع (خطوتان)

### 1️⃣ تثبيت Memurai (Redis لـ Windows)

#### أ. التحميل
افتح المتصفح وانتقل إلى:
```
https://www.memurai.com/get-memurai
```
أو مباشرة:
```
https://docs.memurai.com/en/installation/windows.html#installing-memurai-using-the-windows-installer
```

#### ب. التثبيت
1. حمّل ملف `.msi`
2. شغّل الملف
3. اضغط `Next` → `Next` → `Install`
4. سيعمل تلقائياً كـ Windows Service

#### ج. التحقق من التشغيل
افتح PowerShell وشغّل:
```powershell
Get-Service Memurai
```

يجب أن ترى:
```
Status   Name               DisplayName
------   ----               -----------
Running  Memurai            Memurai
```

إذا لم يكن Running، شغّله:
```powershell
Start-Service Memurai
```

### 2️⃣ تشغيل Celery Worker

افتح PowerShell جديد في مجلد `djangoo`:

```powershell
cd F:\watan\djangoo

# طريقة 1: تشغيل Worker فقط
$env:PYTHONPATH="F:\watan\djangoo"
F:\watan\djangoo\venv\Scripts\python.exe -m celery -A celery_app worker --pool=solo --loglevel=info

# أو طريقة 2: Worker + Beat معاً (يشغل المهام الدورية)
$env:PYTHONPATH="F:\watan\djangoo"
F:\watan\djangoo\venv\Scripts\python.exe -m celery -A celery_app worker --beat --pool=solo --loglevel=info
```

## 📊 ما سيحدث بعد التشغيل

### 1. عند إنشاء طلب جديد
```
====================================================================================================
🔍 [محاولة #1] فحص حالة الطلب: 5565ce34...
====================================================================================================

📡 استعلام عن حالة الطلب من المزود: znet
   المرجع: 1760385232943191
   الحالة الحالية: sent

📥 استجابة المزود:
   الحالة: processing

🔄 معالجة الحالة:
   📌 الحالة من المزود: processing
   📌 الحالة المطبّعة: processing
   📌 الحالة الداخلية الجديدة: pending
   📊 الحالة الحالية: pending

⏳ الطلب لا يزال قيد المعالجة
   الحالة الحالية: processing → processing
   سيتم إعادة الفحص بعد 10 ثواني...
====================================================================================================
```

### 2. بعد 10 ثواني
```
====================================================================================================
🔍 [محاولة #2] فحص حالة الطلب: 5565ce34...
====================================================================================================

📡 استعلام عن حالة الطلب من المزود: znet
...
```

### 3. عندما يكتمل الطلب
```
📥 استجابة المزود:
   الحالة: completed
   PIN Code: ABCD123456...

⚙️ تطبيق انتقال الحالة:
   من: pending → إلى: approved
   سيتم تحديث الرصيد...
   ✅ نجح تحديث الحالة والرصيد

✅ اكتمل فحص الطلب - الحالة النهائية: completed
====================================================================================================
```

### 4. المهمة الدورية (كل 5 دقائق)
```
####################################################################################################
🔍 بدء فحص دفعة الطلبات المعلقة...
   الوقت: 2025-10-13 23:00:00
####################################################################################################

📊 تم العثور على 2 طلب معلق للفحص

الطلبات المعلقة:
   1. 5565ce34... | processing | انتظار: 3 دقيقة
   2. a1b2c3d4... | pending | انتظار: 7 دقيقة

✅ تم جدولة فحص 2 طلب
####################################################################################################
```

## 🔧 استكشاف الأخطاء

### الخطأ: "Cannot connect to redis://localhost:6379"
**الحل**: تأكد من تشغيل Memurai:
```powershell
Start-Service Memurai
```

### الخطأ: "Module celery_app not found"
**الحل**: استخدم PYTHONPATH:
```powershell
$env:PYTHONPATH="F:\watan\djangoo"
```

### الخطأ: "No module named celery"
**الحل**: ثبت celery:
```powershell
cd F:\watan\djangoo
.\venv\Scripts\pip install celery redis django-celery-beat
```

## 📝 إعداد دائم

لتشغيل Celery تلقائياً عند كل بدء:

### إنشاء ملف `start_celery.ps1`
```powershell
# F:\watan\djangoo\start_celery.ps1
$env:PYTHONPATH="F:\watan\djangoo"
Set-Location F:\watan\djangoo
& F:\watan\djangoo\venv\Scripts\python.exe -m celery -A celery_app worker --beat --pool=solo --loglevel=info
```

### تشغيله:
```powershell
cd F:\watan\djangoo
.\start_celery.ps1
```

## 🎯 الخلاصة

بعد تثبيت Memurai وتشغيل Celery:
- ✅ سترى سجلات فحص الطلبات كل 10 ثواني
- ✅ سيتم تحديث حالات الطلبات تلقائياً
- ✅ سيتم إعادة الرصيد عند الإلغاء
- ✅ ستظهر جميع السجلات المفصلة في Terminal

---

**بعد التثبيت، أنشئ طلب جديد وراقب Terminal!** 🚀
